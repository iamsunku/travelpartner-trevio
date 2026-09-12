import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertCustomerSafePayload,
  buildCustomerSafeQuotationView,
  generateCustomerToken,
  hashCustomerToken,
  quoteAcceptedVersionBlockReason,
  quoteCustomerResponseBlockReason,
  accessExpiresAtFromValidTill,
  tokensEqual,
} from "../lib/quotation-customer-access.js";
import { quoteSendBlockReason, quoteConversionBlockReason } from "../lib/quote-access.js";
import { canTransition } from "../lib/quotations.js";

describe("phase 9 customer access token security", () => {
  it("A-B. tokens are high-entropy and hashed; random tokens do not collide", () => {
    const a = generateCustomerToken();
    const b = generateCustomerToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toMatch(/QT-|cuid/i);
    expect(hashCustomerToken(a)).toHaveLength(64);
    expect(hashCustomerToken(a)).not.toBe(a);
    expect(tokensEqual(hashCustomerToken(a), hashCustomerToken(a))).toBe(true);
    expect(tokensEqual(hashCustomerToken(a), hashCustomerToken(b))).toBe(false);
  });

  it("S. customer-safe view does not expose internal quotation id as the access secret", () => {
    const view = buildCustomerSafeQuotationView({
      id: "internal-quote-id",
      quoteNo: "TG-QT-2026-P9",
      customerName: "Dillip",
      status: "Sent to Agent",
      approvalStatus: "Approved",
      total: 10000,
      currency: "INR",
      validTill: "2099-01-01",
      currentVersion: 2,
      internalNotes: "SECRET",
      totalNetCost: 7000,
      grossProfit: 3000,
      agentMarkup: 500,
      packages: [{
        id: "pkg1",
        name: "Deluxe",
        total: 10000,
        hotels: [{ hotelName: "Ubud", contractedCost: 4000, supplier: "Hidden", costPrice: 4000 }],
        flights: [],
        transfers: [],
        activities: [],
        meals: [],
        itinerary: [{ day: 1, title: "Arrival" }],
        inclusions: ["Breakfast"],
        exclusions: [],
        pricing: { finalPrice: 10000, contractedCost: 7000, trevioMarkupAmount: 800, agentMarkup: 200 },
      }],
    }, { versionNumber: 2, canRespond: true });
    expect(view).not.toHaveProperty("id");
    expect(assertCustomerSafePayload(view)).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/contractedCost|supplier|trevioMarkup|agentMarkup|totalNetCost|grossProfit|internalNotes/i);
    expect(view.packages[0].hotels[0]).toMatchObject({ hotelName: "Ubud" });
    expect((view.packages[0].hotels[0] as Record<string, unknown>).contractedCost).toBeUndefined();
  });
});

describe("phase 9 response eligibility / transitions", () => {
  const approved = {
    approvalStatus: "Approved",
    approvals: [{ stage: "Team Lead", status: "Approved" }],
    validTill: "2099-12-31",
  };

  it("D-E-T. draft and unapproved cannot be customer-responded; approval still required to send", () => {
    expect(quoteCustomerResponseBlockReason({ status: "Draft", approvalStatus: "Draft", ...approved, approvalStatus: "Draft" })).toMatch(/not yet available/i);
    expect(quoteSendBlockReason({ status: "Sent to Agent", approvalStatus: "Draft", approvals: [], validTill: "2099-12-31" })).toMatch(/approval/i);
  });

  it("F-G. expired quotations cannot accept/reject/revision", () => {
    expect(quoteCustomerResponseBlockReason({
      status: "Expired",
      validTill: "2020-01-01",
      ...approved,
    })).toMatch(/expired/i);
    expect(quoteCustomerResponseBlockReason({
      status: "Customer Reviewing",
      validTill: "2020-01-01",
      approvalStatus: "Approved",
      approvals: approved.approvals,
    }, new Date("2026-09-12T12:00:00.000Z"))).toMatch(/expired/i);
  });

  it("H. converted quotations cannot accept again", () => {
    expect(quoteCustomerResponseBlockReason({
      status: "Converted to Booking",
      ...approved,
    })).toMatch(/converted/i);
    expect(canTransition("Converted to Booking", "Accepted")).toBe(false);
  });

  it("R. invalid status transitions are rejected by state machine", () => {
    expect(canTransition("Accepted", "Rejected")).toBe(false);
    expect(canTransition("Rejected", "Accepted")).toBe(false);
    expect(canTransition("Revision Requested", "Accepted")).toBe(false);
    expect(canTransition("Customer Reviewing", "Accepted")).toBe(true);
    expect(canTransition("Sent to Agent", "Revision Requested")).toBe(true);
  });

  it("K-N. acceptance version binding blocks stale Version 1 converting Version 2", () => {
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 2,
      acceptedVersionNumber: 1,
    })).toMatch(/version 1/i);
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 2,
      acceptedVersionNumber: 2,
    })).toBeNull();
    expect(quoteConversionBlockReason({
      status: "Accepted",
      approvalStatus: "Approved",
      approvals: approved.approvals,
      validTill: "2099-01-01",
    })).toBeNull();
  });

  it("access expiry aligns with validTill end of UTC day", () => {
    const exp = accessExpiresAtFromValidTill("2026-09-12");
    expect(exp?.toISOString()).toBe("2026-09-12T23:59:59.999Z");
  });
});

describe("phase 9 customer-safe payload invariants", () => {
  it("I-J. forbidden internal fields are detected", () => {
    expect(assertCustomerSafePayload({ total: 1, contractedCost: 2 })).toContain("contractedCost");
    expect(assertCustomerSafePayload({ packages: [{ pricing: { finalPrice: 10 } }] })).toEqual([]);
  });
});

vi.mock("../lib/db.js", () => ({
  db: {
    quotation: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    quotationCustomerAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    quotationCustomerResponse: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    quotationPackage: {
      updateMany: vi.fn(),
    },
    quotationRevision: {
      create: vi.fn(),
    },
    quotationApproval: {
      deleteMany: vi.fn(),
    },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "../lib/db.js";
import {
  createCustomerAccessLink,
  getCustomerQuotationByToken,
  submitCustomerResponse,
} from "../lib/quotation-customer-access.js";

const findQuote = db.quotation.findFirst as ReturnType<typeof vi.fn>;
const createAccess = db.quotationCustomerAccess.create as ReturnType<typeof vi.fn>;
const findAccess = db.quotationCustomerAccess.findUnique as ReturnType<typeof vi.fn>;
const updateAccess = db.quotationCustomerAccess.update as ReturnType<typeof vi.fn>;
const createResponse = db.quotationCustomerResponse.create as ReturnType<typeof vi.fn>;
const updateQuote = db.quotation.update as ReturnType<typeof vi.fn>;
const findPriorAccept = db.quotationCustomerResponse.findFirst as ReturnType<typeof vi.fn>;

function approvedQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    quoteNo: "TG-QT-P9",
    customerName: "Dillip",
    contactEmail: "dillip@example.com",
    status: "Sent to Agent",
    approvalStatus: "Approved",
    currentVersion: 1,
    validTill: "2099-12-31",
    deletedAt: null,
    agencyId: "a1",
    total: 12000,
    amount: 12000,
    gst: 0,
    currency: "INR",
    destination: "Bali",
    packages: [{ id: "pkg1", name: "Deluxe", total: 12000, hotels: [], flights: [], transfers: [], activities: [], meals: [], itinerary: [], inclusions: [], exclusions: [] }],
    approvals: [{ stage: "Team Lead", status: "Approved" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateAccess.mockResolvedValue({});
  (db.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (db.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (db.quotationPackage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  (db.quotationRevision.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("phase 9 customer response flows (mocked)", () => {
  it("C. token maps only to its quotation — unknown hash rejects", async () => {
    findAccess.mockResolvedValue(null);
    await expect(getCustomerQuotationByToken(generateCustomerToken())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("creates hashed access bound to current version", async () => {
    findQuote.mockResolvedValue(approvedQuote());
    createAccess.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "access-1",
      ...data,
    }));
    process.env.PUBLIC_APP_ORIGIN = "https://app.trevio.test";
    const link = await createCustomerAccessLink({ quotationId: "q1", appOrigin: "https://app.trevio.test" });
    expect(link.versionNumber).toBe(1);
    expect(link.url).toContain("/q/");
    expect(link.url).not.toContain("q1");
    expect(createAccess).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tokenHash: hashCustomerToken(link.rawToken),
        versionNumber: 1,
      }),
    }));
  });

  it("K-L-M. accept / reject / revision record version and type", async () => {
    const raw = generateCustomerToken();
    findAccess.mockResolvedValue({
      id: "acc1",
      quotationId: "q1",
      tokenHash: hashCustomerToken(raw),
      versionNumber: 1,
      revokedAt: null,
      expiresAt: null,
    });
    findQuote.mockResolvedValue(approvedQuote({ status: "Customer Reviewing" }));
    createResponse.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "resp1",
      createdAt: new Date(),
      ...data,
    }));
    updateQuote.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...approvedQuote({ status: String(data.status) }),
      ...data,
      packages: approvedQuote().packages,
    }));

    const accept = await submitCustomerResponse({ rawToken: raw, responseType: "Accept", personName: "Dillip" });
    expect(accept.response?.responseType).toBe("Accept");
    expect(accept.response?.versionNumber).toBe(1);
    expect(updateQuote).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "Accepted", acceptedVersionNumber: 1 }),
    }));

    findQuote.mockResolvedValue(approvedQuote({ status: "Customer Reviewing" }));
    const reject = await submitCustomerResponse({ rawToken: raw, responseType: "Reject", comment: "Too expensive" });
    expect(reject.response?.responseType).toBe("Reject");
    expect(reject.response?.versionNumber).toBe(1);

    findQuote.mockResolvedValue(approvedQuote({ status: "Sent to Agent" }));
    const rev = await submitCustomerResponse({ rawToken: raw, responseType: "RevisionRequested", comment: "Need beach villa" });
    expect(rev.response?.responseType).toBe("RevisionRequested");
    expect(rev.response?.versionNumber).toBe(1);
  });

  it("N-O. version mismatch blocks accept; prior response history remains separate", async () => {
    const raw = generateCustomerToken();
    findAccess.mockResolvedValue({
      id: "acc1",
      quotationId: "q1",
      tokenHash: hashCustomerToken(raw),
      versionNumber: 1,
      revokedAt: null,
      expiresAt: null,
    });
    findQuote.mockResolvedValue(approvedQuote({ status: "Customer Reviewing", currentVersion: 2 }));
    await expect(submitCustomerResponse({ rawToken: raw, responseType: "Accept" })).rejects.toMatchObject({
      code: "VERSION_MISMATCH",
      statusCode: 409,
    });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it("Q. double-submit accept is idempotent", async () => {
    const raw = generateCustomerToken();
    findAccess.mockResolvedValue({
      id: "acc1",
      quotationId: "q1",
      tokenHash: hashCustomerToken(raw),
      versionNumber: 1,
      revokedAt: null,
      expiresAt: null,
    });
    findQuote.mockResolvedValue(approvedQuote({
      status: "Accepted",
      acceptedVersionNumber: 1,
    }));
    findPriorAccept.mockResolvedValue({
      id: "resp-old",
      responseType: "Accept",
      versionNumber: 1,
      createdAt: new Date(),
    });
    const again = await submitCustomerResponse({ rawToken: raw, responseType: "Accept" });
    expect(again.idempotent).toBe(true);
    expect(createResponse).not.toHaveBeenCalled();
  });

  it("P. material post-approval edit invalidates conversion via acceptedVersion mismatch helper", () => {
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 3,
      acceptedVersionNumber: 2,
    })).toMatch(/current version is 3/i);
  });
});
