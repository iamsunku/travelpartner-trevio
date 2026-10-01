import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  tx,
  dbMock,
  ensureInitialQuotationVersion,
} = vi.hoisted(() => {
  const ensureInitialQuotationVersion = vi.fn(async () => ({ id: "v1", versionNumber: 1 }));
  const tx = {
    quotation: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    quotationPackage: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    quotationVersion: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  const dbMock = {
    quotation: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    quotationPackage: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    quotationVersion: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, dbMock, ensureInitialQuotationVersion };
});

vi.mock("../lib/db.js", () => ({ db: dbMock }));

vi.mock("../lib/quotation-versions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/quotation-versions.js")>();
  return {
    ...actual,
    ensureInitialQuotationVersion,
  };
});

import {
  isPrismaSerializationFailure,
  isPrismaUniqueConflict,
  nextQuoteNo,
  runWithUniqueQuoteNo,
} from "../lib/quotations.js";
import { cloneQuotationAsDraft, type QuotationCloneSource } from "../lib/quotation-clone.js";
import { Prisma } from "@prisma/client";

function baseSource(overrides: Partial<QuotationCloneSource> = {}): QuotationCloneSource {
  const pkgId = "pkg-old-1";
  return {
    id: "q-source",
    agencyId: "agency-1",
    branchId: "branch-1",
    quoteNo: "TG-QT-2026-000001",
    customerName: "Acme Traveler",
    service: "Holiday",
    items: 1,
    amount: 10000,
    gst: 0,
    total: 10000,
    status: "Accepted",
    validTill: "2026-12-31",
    createdById: "user-old",
    createdBy: "old@example.com",
    isInternational: false,
    contactPerson: "Pat",
    contactEmail: "pat@example.com",
    contactPhone: "999",
    destination: "Bali",
    country: "Indonesia",
    coverImage: null,
    departureCity: "DEL",
    travelDates: "2026-11-01",
    returnDate: "2026-11-05",
    nights: 4,
    days: 5,
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelStarPreference: "4",
    roomTypePreference: "Deluxe",
    mealPlanPreference: "BB",
    nationality: "Indian",
    landOnly: true,
    estimatedBookingDate: null,
    tripCities: [{ city: "Bali", nights: 4, order: 1 }],
    location: "Ubud",
    budget: 50000,
    currency: "INR",
    packageIncludes: ["Hotel"],
    packageExcludes: ["Flights"],
    termsAndConditions: "T&C",
    paymentTerms: "50%",
    cancellationPolicy: "Strict",
    salesExecutiveName: "SE Name",
    salesExecutivePhone: "111",
    salesExecutiveEmail: "se@example.com",
    approvalStatus: "Approved",
    lineItems: [],
    couponCode: "SAVE10",
    couponDiscount: 100,
    quoteDate: "2026-01-01",
    travelStartDate: "2026-11-01",
    travelEndDate: "2026-11-05",
    agentName: "Agent Zero",
    agentId: "agent-1",
    agentCode: "WAN-AGT-0001",
    agencyCode: "WAN",
    specialRequests: "Late checkout",
    internalNotes: "VIP",
    refundPolicy: null,
    hotelTerms: null,
    flightTerms: null,
    visaTerms: null,
    insuranceTerms: null,
    forceMajeure: null,
    travelDisclaimer: null,
    termsSnapshot: { version: 1 },
    templateSnapshot: { templateId: "tpl-1" },
    appliedTemplateId: "tpl-1",
    baseCurrency: "INR",
    exchangeRate: 1,
    totalNetCost: 8000,
    totalSelling: 10000,
    grossProfit: 2000,
    profitMargin: 20,
    discountType: "Fixed",
    discountValue: 100,
    discountAmount: 100,
    taxRate: 5,
    taxRuleId: "tax-rule-1",
    taxableAmount: 9900,
    trevioMarkupType: "Percentage",
    trevioMarkupValue: 10,
    agentMarkupType: "Fixed",
    exchangeRateExplicit: true,
    pricingStatus: "OK",
    perPersonCost: 5000,
    currentVersion: 3,
    wizardStep: 4,
    enquiryRef: "ENQ-9",
    leadId: "lead-1",
    selectedPackageId: pkgId,
    agentMarkup: 500,
    baseSellingTotal: 9500,
    acceptedByName: "Customer",
    acceptedByEmail: "c@example.com",
    acceptedAt: new Date("2026-09-01"),
    acceptedVersionNumber: 3,
    rejectedReason: null,
    convertedBookingId: "booking-should-not-copy",
    convertedAt: new Date("2026-09-02"),
    convertedBy: "ops",
    archivedAt: null,
    deletedAt: null,
    expiredAt: null,
    travelProposalId: "proposal-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-09-01"),
    packages: [
      {
        id: pkgId,
        quotationId: "q-source",
        name: "Deluxe",
        sortOrder: 0,
        isSelected: true,
        description: "Nice",
        hotels: [{ hotelName: "Ubud Inn", sellingPrice: 7000 }],
        flights: [],
        transfers: [{ name: "Airport" }],
        activities: [{ name: "Temple" }],
        meals: [{ name: "Dinner" }],
        itinerary: [{ day: 1, title: "Arrive" }],
        visa: null,
        insurance: null,
        addOns: [{ name: "SIM" }],
        inclusions: ["Breakfast"],
        exclusions: ["Flights"],
        totalNetCost: 8000,
        totalSelling: 10000,
        grossProfit: 2000,
        gst: 0,
        total: 10000,
        perPersonCost: 5000,
        pricing: {
          contractedCost: 8000,
          trevioMarkupAmount: 800,
          customerPrice: 10000,
          finalPrice: 10000,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ...overrides,
  } as QuotationCloneSource;
}

describe("quotation clone / Save as New", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.quotation.findFirst.mockResolvedValue({ quoteNo: "TG-QT-2026-000001" });
    tx.quotation.count.mockResolvedValue(1);
    tx.quotation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "q-new",
      ...data,
    }));
    tx.quotationPackage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "pkg-new-1",
      isSelected: Boolean(data.isSelected),
      ...data,
    }));
    tx.quotationPackage.updateMany.mockResolvedValue({ count: 1 });
    tx.quotationPackage.update.mockResolvedValue({ id: "pkg-new-1" });
    tx.quotation.update.mockResolvedValue({ id: "q-new" });
    tx.quotation.findUnique.mockResolvedValue({
      id: "q-new",
      quoteNo: "TG-QT-2026-000002",
      leadId: "lead-1",
      packages: [{ id: "pkg-new-1", pricing: { finalPrice: 10000 } }],
      versions: [{ versionNumber: 1 }],
      approvals: [],
      revisions: [],
      shares: [],
      documents: [],
    });
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
    ensureInitialQuotationVersion.mockResolvedValue({ id: "v1", versionNumber: 1 });
  });

  it("TEST 3/4/5/6/7/8: Save as New creates new Draft with CRM/pricing/markups/tax/agent preserved", async () => {
    const source = baseSource();
    await cloneQuotationAsDraft({
      source,
      actor: { userId: "actor-1", email: "actor@example.com" },
      branchId: "branch-actor",
      auditAction: "Quotation Saved as New",
    });

    expect(tx.quotation.create).toHaveBeenCalledTimes(1);
    const data = tx.quotation.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.quoteNo).toBe("TG-QT-2026-000002");
    expect(data.status).toBe("Draft");
    expect(data.approvalStatus).toBe("Draft");
    expect(data.currentVersion).toBe(1);
    expect(data.leadId).toBe("lead-1");
    expect(data.enquiryRef).toBe("ENQ-9");
    expect(data.agentId).toBe("agent-1");
    expect(data.agentCode).toBe("WAN-AGT-0001");
    expect(data.agencyCode).toBe("WAN");
    expect(data.agencyId).toBe("agency-1");
    expect(data.taxRuleId).toBe("tax-rule-1");
    expect(data.trevioMarkupValue).toBe(10);
    expect(data.agentMarkup).toBe(500);
    expect(data.baseSellingTotal).toBe(9500);
    expect(data.salesExecutiveEmail).toBe("se@example.com");
    expect(data.createdById).toBe("actor-1");
    expect(data.createdBy).toBe("actor@example.com");
    // DO NOT COPY lifecycle / booking
    expect(data.acceptedByName).toBeUndefined();
    expect(data.acceptedAt).toBeUndefined();
    expect(data.convertedBookingId).toBeUndefined();
    expect(data.acceptedVersionNumber).toBeUndefined();
  });

  it("TEST 9/10: creates new package IDs, remaps selectedPackageId, copies pricing JSON", async () => {
    const source = baseSource();
    await cloneQuotationAsDraft({
      source,
      actor: { userId: "actor-1", email: "actor@example.com" },
      auditAction: "Quote Duplicated",
    });

    expect(tx.quotationPackage.create).toHaveBeenCalledTimes(1);
    const pkgData = tx.quotationPackage.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(pkgData.quotationId).toBe("q-new");
    expect(pkgData.pricing).toEqual({
      contractedCost: 8000,
      trevioMarkupAmount: 800,
      customerPrice: 10000,
      finalPrice: 10000,
    });
    expect(pkgData.hotels).toEqual([{ hotelName: "Ubud Inn", sellingPrice: 7000 }]);
    expect(pkgData.id).toBeUndefined();

    expect(tx.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-new" },
        data: { selectedPackageId: "pkg-new-1" },
      }),
    );
  });

  it("TEST 11: creates Version 1 via ensureInitialQuotationVersion", async () => {
    await cloneQuotationAsDraft({
      source: baseSource(),
      actor: { email: "actor@example.com" },
      auditAction: "Quotation Saved as New",
    });
    expect(ensureInitialQuotationVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        quotationId: "q-new",
        changeSummary: "Version 1",
      }),
    );
  });

  it("TEST 12/14: does not copy versions/shares/documents/approvals child rows", async () => {
    await cloneQuotationAsDraft({
      source: baseSource(),
      actor: { email: "actor@example.com" },
      auditAction: "Quotation Saved as New",
    });
    // Only Version 1 bootstrap — no bulk insert of source versions/shares/docs
    expect(tx.quotationVersion.create).not.toHaveBeenCalled();
    expect(ensureInitialQuotationVersion).toHaveBeenCalledTimes(1);
  });

  it("TEST 13: accepted/booking state is not present on create payload", async () => {
    await cloneQuotationAsDraft({
      source: baseSource({
        status: "Converted to Booking",
        convertedBookingId: "bk-9",
        acceptedAt: new Date(),
        acceptedByName: "X",
      }),
      actor: { email: "a@b.com" },
      auditAction: "Quotation Saved as New",
    });
    const data = tx.quotation.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("Draft");
    expect(data).not.toHaveProperty("convertedBookingId");
    expect(data).not.toHaveProperty("acceptedAt");
    expect(data).not.toHaveProperty("acceptedByName");
  });

  it("TEST 15: package create failure rolls back (transaction throws)", async () => {
    tx.quotationPackage.create.mockRejectedValueOnce(new Error("package boom"));
    await expect(
      cloneQuotationAsDraft({
        source: baseSource(),
        actor: { email: "a@b.com" },
        auditAction: "Quotation Saved as New",
      }),
    ).rejects.toThrow(/package boom/i);
  });

  it("TEST 17: wizard overrides (unsaved changes) win over DB snapshot", async () => {
    await cloneQuotationAsDraft({
      source: baseSource(),
      actor: { email: "a@b.com" },
      auditAction: "Quotation Saved as New",
      overrides: {
        customerName: "Edited Customer",
        destination: "Langkawi",
        trevioMarkupValue: 15,
        packages: [
          {
            id: "pkg-old-1",
            name: "Edited Package",
            isSelected: true,
            hotels: [{ hotelName: "New Hotel" }],
            flights: [],
            transfers: [],
            activities: [],
            meals: [],
            itinerary: [],
            addOns: [],
            inclusions: [],
            exclusions: [],
            pricing: { finalPrice: 12345 },
            totalNetCost: 1,
            totalSelling: 2,
            grossProfit: 1,
            gst: 0,
            total: 2,
            perPersonCost: 1,
          },
        ],
      },
    });
    const data = tx.quotation.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.customerName).toBe("Edited Customer");
    expect(data.destination).toBe("Langkawi");
    expect(data.trevioMarkupValue).toBe(15);
    const pkgData = tx.quotationPackage.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(pkgData.name).toBe("Edited Package");
    expect(pkgData.pricing).toEqual({ finalPrice: 12345 });
    expect(pkgData.hotels).toEqual([{ hotelName: "New Hotel" }]);
  });

  it("does not mutate source quotation (no update/delete on source id)", async () => {
    await cloneQuotationAsDraft({
      source: baseSource(),
      actor: { email: "a@b.com" },
      auditAction: "Quotation Saved as New",
    });
    for (const call of tx.quotation.update.mock.calls) {
      expect(call[0].where.id).not.toBe("q-source");
    }
  });
});

describe("nextQuoteNo concurrency helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TEST 16: runWithUniqueQuoteNo retries on quoteNo unique conflict", async () => {
    let attempts = 0;
    dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => {
      attempts += 1;
      if (attempts === 1) {
        const err = Object.assign(new Error("Unique"), { code: "P2002", meta: { target: ["quoteNo"] } });
        throw err;
      }
      tx.quotation.findFirst.mockResolvedValueOnce({ quoteNo: "TG-QT-2026-000010" });
      return fn(tx);
    });

    const result = await runWithUniqueQuoteNo(async (_tx, quoteNo) => quoteNo);
    expect(attempts).toBe(2);
    expect(result).toMatch(/^TG-QT-\d{4}-\d{6}$/);
  });

  it("detects Prisma unique and serialization failures", () => {
    expect(isPrismaUniqueConflict({ code: "P2002", meta: { target: ["quoteNo"] } }, "quoteNo")).toBe(true);
    expect(isPrismaUniqueConflict({ code: "P2002", meta: { target: ["email"] } }, "quoteNo")).toBe(false);
    expect(isPrismaSerializationFailure({ code: "P2034" })).toBe(true);
    expect(isPrismaSerializationFailure({ code: "P2002" })).toBe(false);
  });

  it("nextQuoteNo increments from latest prefix", async () => {
    dbMock.quotation.findFirst.mockResolvedValue({ quoteNo: "TG-QT-2026-000007" });
    await expect(nextQuoteNo(dbMock as never)).resolves.toBe("TG-QT-2026-000008");
  });

  it("Serializable isolation is requested for quoteNo allocation", async () => {
    dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown, _opts?: unknown) => {
      tx.quotation.findFirst.mockResolvedValue(null);
      tx.quotation.count.mockResolvedValue(0);
      return fn(tx);
    });
    await runWithUniqueQuoteNo(async (_tx, quoteNo) => quoteNo);
    expect(dbMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });
});
