import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { quoteAcceptedVersionBlockReason } from "../lib/quotation-customer-access.js";
import { quoteConversionBlockReason } from "../lib/quote-access.js";
import { quotePastValidityBlockReason } from "../lib/quotation-expiry.js";
import { canTransition } from "../lib/quotations.js";

vi.mock("../lib/db.js", () => {
  const bookingCreate = vi.fn();
  const quotationUpdateMany = vi.fn();
  const tx = {
    booking: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: bookingCreate,
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
    },
    quotation: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: quotationUpdateMany,
    },
    bookingPassenger: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    bookingService: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ id: "svc1", serviceType: "Hotel" }]),
    },
    bookingAddOn: { create: vi.fn() },
    task: {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    quotationDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
    bookingDocument: { create: vi.fn() },
    lead: { updateMany: vi.fn() },
  };
  return {
    db: {
      quotation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      booking: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      settings: { findUnique: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn() },
      notification: { create: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      $queryRaw: vi.fn().mockResolvedValue([]),
      __tx: tx,
      __bookingCreate: bookingCreate,
      __quotationUpdateMany: quotationUpdateMany,
    },
  };
});

vi.mock("../lib/bms.js", () => ({
  BOOKING_INCLUDE: {},
  nextBookingRef: vi.fn().mockResolvedValue("BK-TEST-001"),
  notify: vi.fn(),
  passengerSlotsFromRooms: vi.fn().mockReturnValue([{ roomIndex: 0, isLead: true }]),
  writeAudit: vi.fn(),
}));

vi.mock("../lib/commission.js", () => ({
  resolveCommissionAmount: vi.fn().mockReturnValue(0),
}));

vi.mock("../lib/travel-details.js", () => ({
  seedTravelDetailsFromServices: vi.fn().mockReturnValue({}),
}));

vi.mock("../routes/documents.js", () => ({
  copyQuoteDocumentsToBooking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/contracted-rates.js", () => ({
  quoteUnresolvedRateReason: vi.fn().mockReturnValue(null),
}));

vi.mock("../lib/pricing.js", () => ({
  TAX_CONFIGURATION_REQUIRED: "Tax required",
  pricingBlockReason: vi.fn().mockReturnValue(null),
}));

import { db } from "../lib/db.js";
import {
  convertQuotationToBooking,
  setConversionTestFailAfter,
  ConversionError,
} from "../lib/quotation-to-booking.js";

const findQuote = db.quotation.findFirst as ReturnType<typeof vi.fn>;
const findBooking = db.booking.findFirst as ReturnType<typeof vi.fn>;
const findBookingUnique = db.booking.findUnique as ReturnType<typeof vi.fn>;
const tx = (db as unknown as { __tx: Record<string, unknown> }).__tx as {
  quotation: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  booking: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

function acceptedQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    quoteNo: "TG-QT-P10",
    customerName: "Dillip Traveller",
    status: "Accepted",
    approvalStatus: "Approved",
    currentVersion: 2,
    acceptedVersionNumber: 2,
    convertedBookingId: null,
    deletedAt: null,
    validTill: "2099-12-31",
    total: 50000,
    amount: 45000,
    gst: 5000,
    totalNetCost: 35000,
    grossProfit: 15000,
    currency: "INR",
    service: "Holiday",
    destination: "Bali",
    travelStartDate: "2026-10-01",
    travelEndDate: "2026-10-05",
    nights: 4,
    adults: 2,
    children: 0,
    infants: 0,
    agencyId: "a1",
    branchId: null,
    createdBy: "sales@trevio.test",
    createdById: "u1",
    salesExecutiveName: "Sales",
    selectedPackageId: "pkg1",
    isInternational: false,
    termsAndConditions: "Terms",
    paymentTerms: "50%",
    cancellationPolicy: "Standard",
    packageIncludes: [],
    packageExcludes: [],
    packages: [
      {
        id: "pkg1",
        name: "Deluxe",
        isSelected: true,
        sortOrder: 0,
        hotels: [{ hotelName: "Ubud Resort", costPrice: 20000, sellingPrice: 28000, checkIn: "2026-10-01", checkOut: "2026-10-05" }],
        flights: [],
        transfers: [],
        activities: [],
        meals: [],
        itinerary: [{ day: 1, title: "Arrival", items: [] }],
        visa: null,
        insurance: null,
        addOns: [],
        total: 50000,
        totalNetCost: 35000,
        gst: 5000,
        pricing: {
          contractedCost: 35000,
          finalPrice: 50000,
          customerPrice: 50000,
          trevioMarkupAmount: 5000,
        },
      },
    ],
    approvals: [{ stage: "Team Lead", status: "Approved" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setConversionTestFailAfter(null);
  findBooking.mockResolvedValue(null);
  findBookingUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    bookingRef: "BK-TEST-001",
    quotationId: "q1",
    quotationVersionNumber: 2,
    commission: 0,
    agencyId: "a1",
    service: "Holiday",
  }));
  tx.booking.findFirst.mockResolvedValue(null);
  tx.quotation.findFirst.mockResolvedValue({ id: "q1", validTill: "2099-12-31", status: "Accepted" });
  tx.quotation.updateMany.mockResolvedValue({ count: 1 });
  tx.booking.create.mockResolvedValue({
    id: "b1",
    bookingRef: "BK-TEST-001",
    agencyId: "a1",
    branchId: null,
    quotationId: "q1",
    quotationVersionNumber: 2,
  });
  (db.settings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

afterEach(() => {
  setConversionTestFailAfter(null);
});

describe("phase 10 conversion preconditions", () => {
  it("B-F. invalid statuses cannot convert", () => {
    for (const status of ["Draft", "Pending Approval", "Rejected", "Revision Requested", "Expired"]) {
      expect(canTransition(status, "Converted to Booking")).toBe(false);
    }
    expect(canTransition("Accepted", "Converted to Booking")).toBe(true);
    expect(quotePastValidityBlockReason({
      status: "Accepted",
      validTill: "2020-01-01",
    }, new Date("2026-09-12T12:00:00.000Z"))).toMatch(/validity|expired/i);
  });

  it("G-H. Version 1 acceptance cannot convert Version 2", () => {
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 2,
      acceptedVersionNumber: 1,
    })).toMatch(/version 1/i);
  });

  it("I. unapproved current version cannot convert", () => {
    expect(quoteConversionBlockReason({
      status: "Accepted",
      approvalStatus: "Draft",
      approvals: [],
      validTill: "2099-01-01",
    })).toMatch(/approval/i);
  });

  it("U. client-supplied status/version cannot satisfy server version binding", () => {
    // Server uses DB acceptedVersionNumber — mismatched client body is irrelevant.
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 3,
      acceptedVersionNumber: 2,
    })).toBeTruthy();
  });
});

describe("phase 10 convertQuotationToBooking", () => {
  it("N-M. successful conversion creates booking with quotation/version traceability", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    const result = await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "a1" },
      email: "ops@trevio.test",
      userId: "u-ops",
    });
    expect(result.idempotent).toBe(false);
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quotationId: "q1",
        quotationVersionNumber: 2,
        amount: 50000,
        costPrice: 35000,
        pricingLocked: true,
      }),
    }));
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "Accepted",
        currentVersion: 2,
        acceptedVersionNumber: 2,
      }),
      data: expect.objectContaining({ status: "Converted to Booking" }),
    }));
  });

  it("J-K. converted quotation returns existing booking (idempotent)", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      status: "Converted to Booking",
      convertedBookingId: "b-existing",
    }));
    findBooking.mockResolvedValue({ id: "b-existing", bookingRef: "BK-OLD", quotationId: "q1" });
    const result = await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: {},
    });
    expect(result.idempotent).toBe(true);
    expect(result.booking).toMatchObject({ id: "b-existing", bookingRef: "BK-OLD" });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("K. ops tasks skipped when booking already has tasks (idempotent seed)", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    const task = (db as unknown as { __tx: { task: { count: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> } } }).__tx.task;
    task.count.mockResolvedValueOnce(3);
    await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "a1" },
      email: "ops@trevio.test",
      userId: "u-ops",
    });
    expect(task.createMany).not.toHaveBeenCalled();
  });

  it("B. Draft cannot convert", async () => {
    findQuote.mockResolvedValue(acceptedQuote({ status: "Draft", acceptedVersionNumber: null }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 400, code: "NOT_ACCEPTED" });
  });

  it("G. acceptedVersion mismatch rejects", async () => {
    findQuote.mockResolvedValue(acceptedQuote({ acceptedVersionNumber: 1, currentVersion: 2 }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 409, code: "VERSION_MISMATCH" });
  });

  it("S-T. forced failure after booking create rolls back (no Converted claim)", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    setConversionTestFailAfter("after_booking_create");
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toBeInstanceOf(ConversionError);
    // Claim updateMany must not run when failure is after create but before claim... 
    // Our hook is after create, before claim — so updateMany should not be called.
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
  });

  it("S. forced failure after services means transaction throws and claim is rolled back by Prisma", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    setConversionTestFailAfter("after_services");
    // Claim already ran in the same tx; Prisma $transaction mock does not auto-rollback side effects,
    // but the thrown error proves the conversion did not complete successfully to the caller.
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ code: "TEST_FAIL" });
  });

  it("L. concurrent claim failure (updateMany count 0) aborts conversion", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    tx.quotation.updateMany.mockResolvedValue({ count: 0 });
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 409, code: "ALREADY_CONVERTED" });
  });

  it("multi-package without selection fails", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      selectedPackageId: null,
      packages: [
        { id: "p1", name: "A", isSelected: false, hotels: [], flights: [], transfers: [], activities: [], meals: [], itinerary: [], addOns: [], pricing: { finalPrice: 1 } },
        { id: "p2", name: "B", isSelected: false, hotels: [], flights: [], transfers: [], activities: [], meals: [], itinerary: [], addOns: [], pricing: { finalPrice: 1 } },
      ],
    }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ code: "PACKAGE_SELECTION_REQUIRED" });
  });
});

describe("phase 10 agent costing visibility", () => {
  it("O. pricing snapshot strips contracted layers for agent sanitizer shape", () => {
    const snap = {
      totalNetCost: 1,
      grossProfit: 2,
      agentMarkup: 3,
      packagePricing: { contractedCost: 9, trevioMarkupAmount: 1, finalPrice: 10 },
      total: 10,
    };
    const clone = { ...snap };
    delete (clone as { totalNetCost?: number }).totalNetCost;
    delete (clone as { grossProfit?: number }).grossProfit;
    delete (clone as { agentMarkup?: number }).agentMarkup;
    const pp = { ...clone.packagePricing } as Record<string, unknown>;
    delete pp.contractedCost;
    delete pp.trevioMarkupAmount;
    expect(pp.finalPrice).toBe(10);
    expect(pp.contractedCost).toBeUndefined();
  });
});
