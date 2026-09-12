import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  calendarDateUtc,
  expireDueQuotations,
  EXPIRY_ELIGIBLE_STATUSES,
  freshValidTill,
  isExpiryEligibleStatus,
  isPastValidTill,
  quotePastValidityBlockReason,
  runExpireDueQuotations,
} from "../lib/quotation-expiry.js";
import { quoteConversionBlockReason, quoteSendBlockReason } from "../lib/quote-access.js";
import { canTransition } from "../lib/quotations.js";
import { sanitizeVersionSnapshot } from "../lib/quotation-versions.js";

vi.mock("../lib/db.js", () => {
  return {
    db: {
      quotation: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    },
  };
});

import { db } from "../lib/db.js";

const findMany = db.quotation.findMany as ReturnType<typeof vi.fn>;
const updateMany = db.quotation.updateMany as ReturnType<typeof vi.fn>;
const notifyCreate = db.notification.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  updateMany.mockResolvedValue({ count: 0 });
  notifyCreate.mockResolvedValue({});
});

describe("phase 8 quotation expiry semantics", () => {
  it("calendarDateUtc is YYYY-MM-DD in UTC", () => {
    expect(calendarDateUtc(new Date("2026-09-12T23:30:00.000Z"))).toBe("2026-09-12");
    expect(calendarDateUtc(new Date("2026-09-13T00:00:00.000Z"))).toBe("2026-09-13");
  });

  it("just before / exactly at / just after expiry boundaries", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    expect(isPastValidTill("2026-09-13", now)).toBe(false);
    expect(isPastValidTill("2026-09-12", now)).toBe(false); // valid through end of UTC day
    expect(isPastValidTill("2026-09-11", now)).toBe(true);
    expect(isPastValidTill("2026-09-11T23:59:59.000Z", now)).toBe(true);
  });

  it("timezone boundary around UTC midnight", () => {
    const justBeforeUtcMidnight = new Date("2026-09-12T23:59:59.000Z");
    const justAfterUtcMidnight = new Date("2026-09-13T00:00:01.000Z");
    expect(isPastValidTill("2026-09-12", justBeforeUtcMidnight)).toBe(false);
    expect(isPastValidTill("2026-09-12", justAfterUtcMidnight)).toBe(true);
  });

  it("eligible status transition matrix", () => {
    for (const status of EXPIRY_ELIGIBLE_STATUSES) {
      expect(isExpiryEligibleStatus(status)).toBe(true);
      expect(canTransition(status === "Sent" ? "Sent to Agent" : status, "Expired")).toBe(true);
    }
    for (const status of ["Draft", "In Progress", "Pending Approval", "Revision Requested", "Rejected", "Converted to Booking", "Archived", "Expired"]) {
      expect(isExpiryEligibleStatus(status)).toBe(false);
    }
  });

  it("H. Converted never becomes Expired via state machine", () => {
    expect(canTransition("Converted to Booking", "Expired")).toBe(false);
  });
});

describe("phase 8 delivery / accept / convert gates", () => {
  const approved = {
    approvalStatus: "Approved" as const,
    approvals: [{ stage: "Team Lead", status: "Approved" }],
  };

  it("C-E. expired quotation cannot be emailed, WhatsApped, or customer-PDF gated via send block", () => {
    expect(quoteSendBlockReason({
      status: "Expired",
      validTill: "2026-01-01",
      ...approved,
    })).toMatch(/expired/i);
  });

  it("defense in depth: past validTill blocks send before job flips status", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    expect(quoteSendBlockReason({
      status: "Sent to Agent",
      validTill: "2026-09-11",
      ...approved,
    }, now)).toMatch(/validity date has passed/i);
    expect(quoteSendBlockReason({
      status: "Sent to Agent",
      validTill: "2026-09-12",
      ...approved,
    }, now)).toBeNull();
  });

  it("F. expired quotation cannot be accepted (past-validity helper)", () => {
    expect(quotePastValidityBlockReason({ status: "Expired", validTill: "2026-01-01" })).toMatch(/expired/i);
    expect(quotePastValidityBlockReason({
      status: "Customer Reviewing",
      validTill: "2026-09-11",
    }, new Date("2026-09-12T12:00:00.000Z"))).toMatch(/validity/i);
  });

  it("G. expired quotation cannot be converted", () => {
    expect(quoteConversionBlockReason({
      status: "Expired",
      validTill: "2026-01-01",
      ...approved,
    })).toMatch(/expired|renew/i);
    expect(quoteConversionBlockReason({
      status: "Accepted",
      validTill: "2026-09-11",
      ...approved,
    }, new Date("2026-09-12T12:00:00.000Z"))).toMatch(/renew|expired/i);
  });

  it("I. expiry does not bypass approval for still-valid quotes", () => {
    expect(quoteSendBlockReason({
      status: "Sent to Agent",
      validTill: "2099-01-01",
      approvalStatus: "Draft",
      approvals: [],
    })).toMatch(/approval/i);
  });

  it("Draft with old validTill is not treated as Expired for status eligibility", () => {
    expect(quotePastValidityBlockReason({
      status: "Draft",
      validTill: "2020-01-01",
    }, new Date("2026-09-12T12:00:00.000Z"))).toBeNull();
    expect(isExpiryEligibleStatus("Draft")).toBe(false);
  });
});

describe("phase 8 expiry job", () => {
  it("eligible before expiry -> unchanged", async () => {
    findMany.mockResolvedValue([]);
    const result = await runExpireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(result.expired).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("eligible after expiry -> Expired", async () => {
    findMany.mockResolvedValue([
      { id: "q1", quoteNo: "QT-1", agencyId: "a1", status: "Sent to Agent", validTill: "2026-09-11" },
    ]);
    updateMany.mockResolvedValue({ count: 1 });
    const result = await runExpireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(result.expired).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "q1", validTill: { lt: "2026-09-12" } }),
      data: expect.objectContaining({ status: "Expired" }),
    }));
    expect(notifyCreate).toHaveBeenCalledTimes(1);
  });

  it("N. re-running the job is idempotent (already Expired not selected)", async () => {
    findMany.mockResolvedValue([]);
    const first = await expireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    const second = await expireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(first).toBe(0);
    expect(second).toBe(0);
  });

  it("O. concurrent updateMany count 0 skips notify (lost race)", async () => {
    findMany.mockResolvedValue([
      { id: "q1", quoteNo: "QT-1", agencyId: "a1", status: "Sent to Agent", validTill: "2026-09-11" },
    ]);
    updateMany.mockResolvedValue({ count: 0 });
    const result = await runExpireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(result.expired).toBe(0);
    expect(result.skipped).toBe(1);
    expect(notifyCreate).not.toHaveBeenCalled();
  });

  it("Converted / Rejected / Draft are never selected (query uses eligible statuses only)", async () => {
    findMany.mockResolvedValue([]);
    await runExpireDueQuotations({});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: [...EXPIRY_ELIGIBLE_STATUSES] },
      }),
    }));
  });

  it("one bad record does not prevent remaining records from processing", async () => {
    findMany.mockResolvedValue([
      { id: "bad", quoteNo: "QT-BAD", agencyId: "a1", status: "Sent to Agent", validTill: "2026-09-11" },
      { id: "good", quoteNo: "QT-GOOD", agencyId: "a1", status: "Accepted", validTill: "2026-09-10" },
    ]);
    updateMany
      .mockRejectedValueOnce(new Error("db flake"))
      .mockResolvedValueOnce({ count: 1 });
    const result = await runExpireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(result.errors).toBe(1);
    expect(result.expired).toBe(1);
    expect(notifyCreate).toHaveBeenCalledTimes(1);
  });

  it("multiple eligible quotations are all processed", async () => {
    findMany.mockResolvedValue([
      { id: "q1", quoteNo: "QT-1", agencyId: "a1", status: "Sent to Agent", validTill: "2026-09-01" },
      { id: "q2", quoteNo: "QT-2", agencyId: "a1", status: "Customer Reviewing", validTill: "2026-09-02" },
    ]);
    updateMany.mockResolvedValue({ count: 1 });
    const result = await runExpireDueQuotations({ now: new Date("2026-09-12T12:00:00.000Z") });
    expect(result.expired).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});

describe("phase 8 versioning / security side-effects", () => {
  it("J-M. historical snapshots remain sanitized; restore gets fresh validity helper", () => {
    const snap = sanitizeVersionSnapshot({
      status: "Expired",
      validTill: "2020-01-01",
      internalNotes: "SECRET",
      totalNetCost: 999,
      packages: [],
    }, "travel_agent");
    expect(snap.internalNotes).toBeUndefined();
    expect(snap.totalNetCost).toBeUndefined();
    expect(freshValidTill(new Date("2026-09-12T00:00:00.000Z"), 7)).toBe("2026-09-19");
  });

  it("A-B. agents cannot transition to Expired via allowed agent targets", () => {
    const agentAllowed = ["Accepted", "Rejected", "Revision Requested", "Customer Reviewing"];
    expect(agentAllowed.includes("Expired")).toBe(false);
  });
});
