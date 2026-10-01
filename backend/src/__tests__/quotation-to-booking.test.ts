import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { quoteAcceptedVersionBlockReason } from "../lib/quotation-customer-access.js";
import { quoteConversionBlockReason } from "../lib/quote-access.js";
import { quotePastValidityBlockReason } from "../lib/quotation-expiry.js";
import { canTransition } from "../lib/quotations.js";

vi.mock("../lib/db.js", () => {
  const bookingCreate = vi.fn();
  const quotationUpdateMany = vi.fn();
  const bookingServiceCreate = vi.fn().mockResolvedValue({});
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
      create: bookingServiceCreate,
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
      __bookingServiceCreate: bookingServiceCreate,
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
  seedTravelDetailsFromPackage: vi.fn().mockReturnValue({}),
}));

vi.mock("../routes/documents.js", () => ({
  copyQuoteDocumentsToBooking: vi.fn().mockResolvedValue(undefined),
}));

const quoteUnresolvedRateReason = vi.fn().mockReturnValue(null);
vi.mock("../lib/contracted-rates.js", () => ({
  quoteUnresolvedRateReason: (...args: unknown[]) => quoteUnresolvedRateReason(...args),
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
  hotelLineDetails,
  activityLineDetails,
} from "../lib/quotation-to-booking.js";

const findQuote = db.quotation.findFirst as ReturnType<typeof vi.fn>;
const findBooking = db.booking.findFirst as ReturnType<typeof vi.fn>;
const findBookingUnique = db.booking.findUnique as ReturnType<typeof vi.fn>;
const tx = (db as unknown as { __tx: Record<string, unknown> }).__tx as {
  quotation: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  booking: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  bookingService: { create: ReturnType<typeof vi.fn> };
};
const bookingServiceCreate = (db as unknown as { __bookingServiceCreate: ReturnType<typeof vi.fn> }).__bookingServiceCreate;

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
    agencyCode: "WAN",
    branchId: "br1",
    agentId: "agent-1",
    agentName: "Wan Agent",
    agentCode: "WAN-AGT-0001",
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
        hotels: [{
          hotelName: "Ubud Resort",
          productId: "prod-hotel-1",
          productType: "HOTEL",
          lineId: "hl-1",
          rateId: "rate-h-1",
          roomType: "Deluxe",
          mealPlan: "BB",
          checkIn: "2026-10-01",
          checkOut: "2026-10-05",
          nights: 4,
          rooms: 1,
          tripCity: "Ubud",
          costPrice: 20000,
          sellingPrice: 28000,
          source: "CONTRACTED_PRODUCT",
          rateSnapshot: {
            frozen: true,
            rateId: "rate-h-1",
            productId: "prod-hotel-1",
            productType: "HOTEL",
            contractedCost: 20000,
            currency: "INR",
            validFrom: "2026-01-01",
            validTo: "2026-12-31",
            selectedAt: "2026-09-01T00:00:00.000Z",
            travelDate: "2026-10-01",
          },
        }],
        flights: [],
        transfers: [],
        activities: [{
          activityName: "Ubud Tour",
          productId: "prod-act-1",
          productType: "ACTIVITY",
          lineId: "al-1",
          rateId: "rate-a-1",
          date: "2026-10-02",
          city: "Ubud",
          adults: 2,
          children: 0,
          costPrice: 5000,
          sellingPrice: 7500,
          source: "CONTRACTED_PRODUCT",
          rateSnapshot: {
            frozen: true,
            rateId: "rate-a-1",
            productId: "prod-act-1",
            productType: "ACTIVITY",
            contractedCost: 5000,
            currency: "INR",
            validFrom: "2026-01-01",
            validTo: "2026-12-31",
            selectedAt: "2026-09-01T00:00:00.000Z",
            travelDate: "2026-10-02",
          },
        }],
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
  quoteUnresolvedRateReason.mockReturnValue(null);
  findBooking.mockResolvedValue(null);
  findBookingUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    bookingRef: "BK-TEST-001",
    quotationId: "q1",
    quotationVersionNumber: 2,
    commission: 0,
    agencyId: "a1",
    service: "Holiday",
    pricingLocked: true,
  }));
  tx.booking.findFirst.mockResolvedValue(null);
  tx.quotation.findFirst.mockResolvedValue({ id: "q1", validTill: "2099-12-31", status: "Accepted" });
  tx.quotation.updateMany.mockResolvedValue({ count: 1 });
  tx.booking.create.mockResolvedValue({
    id: "b1",
    bookingRef: "BK-TEST-001",
    agencyId: "a1",
    branchId: "br1",
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
    expect(quoteAcceptedVersionBlockReason({
      status: "Accepted",
      currentVersion: 3,
      acceptedVersionNumber: 2,
    })).toBeTruthy();
  });
});

describe("structured line details helpers", () => {
  it("hotelLineDetails preserves rate identity and stay fields", () => {
    const details = hotelLineDetails({
      hotelName: "Resort",
      productId: "p1",
      rateId: "r1",
      roomType: "Deluxe",
      mealPlan: "BB",
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      rooms: 2,
      tripCity: "Ubud",
      costPrice: 100,
      sellingPrice: 150,
      rateSnapshot: { frozen: true, rateId: "r1", productId: "p1", contractedCost: 100 },
    }) as Record<string, unknown>;
    expect(details.kind).toBe("hotel");
    expect(details.rateId).toBe("r1");
    expect(details.roomType).toBe("Deluxe");
    expect(details.mealPlan).toBe("BB");
    expect(details.checkIn).toBe("2026-10-01");
    expect(details.rooms).toBe(2);
    expect(details.city).toBe("Ubud");
  });

  it("activityLineDetails preserves product/rate/date/pax", () => {
    const details = activityLineDetails({
      activityName: "Tour",
      productId: "a1",
      rateId: "ra1",
      date: "2026-10-02",
      city: "Ubud",
      adults: 2,
      costPrice: 50,
      sellingPrice: 80,
    }) as Record<string, unknown>;
    expect(details.kind).toBe("activity");
    expect(details.rateId).toBe("ra1");
    expect(details.date).toBe("2026-10-02");
    expect(details.adults).toBe(2);
    expect(details.city).toBe("Ubud");
  });
});

describe("phase 10 convertQuotationToBooking", () => {
  it("A. Accepted quotation converts with structured hotel/activity + pricingLocked + agent retention", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    const result = await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "a1" },
      email: "ops@trevio.test",
      userId: "u-ops",
      ownAgencyId: "a1",
      ownBranchId: "br-ops",
    });
    expect(result.idempotent).toBe(false);
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quotationId: "q1",
        quotationVersionNumber: 2,
        amount: 50000,
        costPrice: 35000,
        pricingLocked: true,
        agentId: "agent-1",
        agentName: "Wan Agent",
        agentCode: "WAN-AGT-0001",
        agencyId: "a1",
        agencyCode: "WAN",
        branchId: "br-ops",
      }),
    }));

    const hotelCall = bookingServiceCreate.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { serviceType: string } }).data.serviceType === "Hotel",
    );
    const activityCall = bookingServiceCreate.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { serviceType: string } }).data.serviceType === "Attraction",
    );
    expect(hotelCall).toBeTruthy();
    expect(activityCall).toBeTruthy();
    const hotelData = (hotelCall![0] as { data: Record<string, unknown> }).data;
    const activityData = (activityCall![0] as { data: Record<string, unknown> }).data;
    expect(hotelData.lineDetails).toMatchObject({
      kind: "hotel",
      rateId: "rate-h-1",
      roomType: "Deluxe",
      mealPlan: "BB",
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      city: "Ubud",
      productId: "prod-hotel-1",
    });
    expect(hotelData.notes).toBeTruthy();
    expect(activityData.lineDetails).toMatchObject({
      kind: "activity",
      rateId: "rate-a-1",
      date: "2026-10-02",
      city: "Ubud",
      productId: "prod-act-1",
      adults: 2,
    });
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "Accepted",
        currentVersion: 2,
        acceptedVersionNumber: 2,
      }),
      data: expect.objectContaining({ status: "Converted to Booking" }),
    }));
  });

  it("H. does not replace assigned agent with logged-in user", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      agentId: "agent-assigned",
      agentName: "Assigned Agent",
      agentCode: "WAN-AGT-0099",
    }));
    await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "a1" },
      userId: "logged-in-ops",
      email: "ops@trevio.test",
    });
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentId: "agent-assigned",
        agentName: "Assigned Agent",
        agentCode: "WAN-AGT-0099",
      }),
    }));
  });

  it("H. falls back to actor only when quotation has no agentId", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      agentId: null,
      agentName: null,
      agentCode: null,
    }));
    await convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "a1" },
      userId: "logged-in-ops",
      email: "ops@trevio.test",
    });
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentId: "logged-in-ops",
        agentCode: undefined,
      }),
    }));
  });

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

  it("C. Sent cannot convert", async () => {
    findQuote.mockResolvedValue(acceptedQuote({ status: "Sent", acceptedVersionNumber: null }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 400, code: "NOT_ACCEPTED" });
  });

  it("D. Rejected cannot convert", async () => {
    findQuote.mockResolvedValue(acceptedQuote({ status: "Rejected", acceptedVersionNumber: null }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 400, code: "NOT_ACCEPTED" });
  });

  it("E. Expired cannot convert", async () => {
    findQuote.mockResolvedValue(acceptedQuote({ status: "Expired", acceptedVersionNumber: 2 }));
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: {} }))
      .rejects.toMatchObject({ statusCode: 400, code: "EXPIRED" });
  });

  it("F. invalid/expired hotel rate rejects conversion", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    quoteUnresolvedRateReason.mockReturnValue("No valid contracted rate available for selected travel date.");
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: { agencyId: "a1" } }))
      .rejects.toMatchObject({ statusCode: 400, code: "PRICING_UNRESOLVED" });
  });

  it("G. invalid/expired activity rate rejects conversion", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      packages: [{
        ...(acceptedQuote().packages as unknown[])[0] as object,
        hotels: [],
        activities: [{
          activityName: "Expired Tour",
          productId: "prod-act-x",
          rateUnresolved: true,
          rateUnresolvedReason: "No valid contracted rate available for selected travel date.",
        }],
      }],
    }));
    quoteUnresolvedRateReason.mockReturnValue("No valid contracted rate available for selected travel date.");
    await expect(convertQuotationToBooking({ quotationId: "q1", agencyScope: { agencyId: "a1" } }))
      .rejects.toMatchObject({ statusCode: 400, code: "PRICING_UNRESOLVED" });
  });

  it("J. tenant isolation — other agency quotation not found", async () => {
    findQuote.mockResolvedValue(null);
    await expect(convertQuotationToBooking({
      quotationId: "q1",
      agencyScope: { agencyId: "other-agency" },
    })).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(findQuote).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ agencyId: "other-agency" }),
    }));
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
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
  });

  it("S. forced failure after services means transaction throws and claim is rolled back by Prisma", async () => {
    findQuote.mockResolvedValue(acceptedQuote());
    setConversionTestFailAfter("after_services");
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

describe("Save as New independence (conversion gate)", () => {
  it("I. Draft clone cannot convert until Accepted + rates resolved", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      id: "q-new",
      quoteNo: "TG-QT-NEW",
      status: "Draft",
      currentVersion: 1,
      acceptedVersionNumber: null,
      pricingStatus: "UNRESOLVED",
    }));
    await expect(convertQuotationToBooking({ quotationId: "q-new", agencyScope: { agencyId: "a1" } }))
      .rejects.toMatchObject({ code: "NOT_ACCEPTED" });
  });

  it("I. Accepted clone still blocked when freeze left rates unresolved", async () => {
    findQuote.mockResolvedValue(acceptedQuote({
      id: "q-new",
      quoteNo: "TG-QT-NEW",
      status: "Accepted",
      currentVersion: 1,
      acceptedVersionNumber: 1,
    }));
    quoteUnresolvedRateReason.mockReturnValue("No valid contracted rate available for selected travel date.");
    await expect(convertQuotationToBooking({ quotationId: "q-new", agencyScope: { agencyId: "a1" } }))
      .rejects.toMatchObject({ code: "PRICING_UNRESOLVED" });
  });
});
