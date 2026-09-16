import { describe, expect, it } from "vitest";
import {
  normalizeTripCities,
  tripCitiesDestinationLabel,
  tripCitiesTotalNights,
} from "../lib/quote-trip-cities.js";
import {
  buildVersionSnapshot,
  hasMeaningfulQuotationChange,
  materialFingerprint,
} from "../lib/quotation-versions.js";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { quotationSchema } from "../lib/validation.js";
import { pricePackage, type TaxRuleInput } from "../lib/pricing.js";

describe("Module 01A — Trip Plan City Wise", () => {
  it("normalizes create payload Phuket 3 / Krabi 2 / Bangkok 2", () => {
    const cities = normalizeTripCities([
      { city: "Phuket", nights: 3, order: 1 },
      { city: "Krabi", nights: 2, order: 2 },
      { city: "Bangkok", nights: 2, order: 3 },
    ]);
    expect(cities).toEqual([
      { city: "Phuket", nights: 3, order: 1, destinationId: null },
      { city: "Krabi", nights: 2, order: 2, destinationId: null },
      { city: "Bangkok", nights: 2, order: 3, destinationId: null },
    ]);
    expect(tripCitiesTotalNights(cities)).toBe(7);
    expect(tripCitiesDestinationLabel(cities)).toBe("Phuket · Krabi · Bangkok");
  });

  it("independent nights edit: Phuket 3→4 leaves Krabi/Bangkok unchanged", () => {
    const before = normalizeTripCities([
      { city: "Phuket", nights: 3 },
      { city: "Krabi", nights: 2 },
      { city: "Bangkok", nights: 2 },
    ]);
    const after = normalizeTripCities([
      { city: "Phuket", nights: 4 },
      { city: "Krabi", nights: 2 },
      { city: "Bangkok", nights: 2 },
    ]);
    expect(after.find((c) => c.city === "Phuket")?.nights).toBe(4);
    expect(after.find((c) => c.city === "Krabi")?.nights).toBe(2);
    expect(after.find((c) => c.city === "Bangkok")?.nights).toBe(2);
    expect(tripCitiesTotalNights(after)).toBe(8);
    expect(hasMeaningfulQuotationChange(
      { tripCities: before },
      { tripCities: after },
    )).toBe(true);
  });

  it("remove Bangkok then reload shape is Phuket 4 / Krabi 2", () => {
    const saved = normalizeTripCities([
      { city: "Phuket", nights: 4, order: 1 },
      { city: "Krabi", nights: 2, order: 2 },
    ]);
    expect(saved).toEqual([
      { city: "Phuket", nights: 4, order: 1, destinationId: null },
      { city: "Krabi", nights: 2, order: 2, destinationId: null },
    ]);
    expect(tripCitiesDestinationLabel(saved)).toBe("Phuket · Krabi");
  });

  it("drops invalid rows and renumbers order", () => {
    expect(normalizeTripCities([
      { city: "", nights: 2 },
      { city: "Goa", nights: 0 },
      { city: "Goa", nights: 2, order: 99 },
      null,
    ])).toEqual([
      { city: "Goa", nights: 2, order: 1, destinationId: null },
    ]);
  });

  it("legacy empty tripCities stays empty (no silent destination rewrite)", () => {
    expect(normalizeTripCities([])).toEqual([]);
    expect(normalizeTripCities(undefined)).toEqual([]);
  });
});

describe("Module 01A — Basic Details fields (validation + versioning)", () => {
  const basics = {
    customerName: "Client",
    service: "Holiday",
    items: 1,
    amount: 0,
    gst: 0,
    total: 0,
    validTill: "2026-12-31",
    createdBy: "tester",
    departureCity: "Bengaluru",
    rooms: 2,
    hotelStarPreference: "3",
    nationality: "India",
    landOnly: true,
    estimatedBookingDate: "2026-11-15",
    tripCities: [
      { city: "Phuket", nights: 3, order: 1 },
      { city: "Krabi", nights: 2, order: 2 },
    ],
  };

  it("accepts departure city, rooms, star, nationality, landOnly, estimatedBookingDate, tripCities", () => {
    const parsed = quotationSchema.parse(basics);
    expect(parsed.departureCity).toBe("Bengaluru");
    expect(parsed.rooms).toBe(2);
    expect(parsed.hotelStarPreference).toBe("3");
    expect(parsed.nationality).toBe("India");
    expect(parsed.landOnly).toBe(true);
    expect(parsed.estimatedBookingDate).toBe("2026-11-15");
    expect(parsed.tripCities).toHaveLength(2);
  });

  it("rejects rooms below 1", () => {
    expect(() => quotationSchema.parse({ ...basics, rooms: 0 })).toThrow();
  });

  it("rejects trip city with non-positive nights", () => {
    expect(() => quotationSchema.parse({
      ...basics,
      tripCities: [{ city: "Goa", nights: 0 }],
    })).toThrow();
  });

  it("version fingerprint includes tripCities and quote-level basics", () => {
    const a = {
      ...basics,
      packages: [],
    };
    const b = {
      ...a,
      tripCities: [
        { city: "Phuket", nights: 4, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
    };
    expect(materialFingerprint(a)).not.toBe(materialFingerprint(b));
    expect(hasMeaningfulQuotationChange(a, { ...a, rooms: 3 })).toBe(true);
    expect(hasMeaningfulQuotationChange(a, { ...a, landOnly: false })).toBe(true);
    expect(hasMeaningfulQuotationChange(a, { ...a, estimatedBookingDate: "2026-12-01" })).toBe(true);
    expect(hasMeaningfulQuotationChange(a, { ...a, nationality: "Singapore" })).toBe(true);
    expect(hasMeaningfulQuotationChange(a, { ...a, departureCity: "Mumbai" })).toBe(true);
    expect(hasMeaningfulQuotationChange(a, { ...a, hotelStarPreference: "5" })).toBe(true);
  });

  it("version snapshot retains historical tripCities / basics", () => {
    const snap = buildVersionSnapshot({
      ...basics,
      packages: [],
      versions: [{ versionNumber: 1 }],
    });
    expect(snap.tripCities).toEqual(basics.tripCities);
    expect(snap.rooms).toBe(2);
    expect(snap.landOnly).toBe(true);
    expect(snap.estimatedBookingDate).toBe("2026-11-15");
    expect(snap.departureCity).toBe("Bengaluru");
    expect(snap.versions).toBeUndefined();
  });

  it("agent sanitize keeps Module 01A fields but strips internal pricing", () => {
    const out = sanitizeQuotationForRole({
      ...basics,
      internalNotes: "secret",
      totalNetCost: 9000,
      grossProfit: 1000,
      packages: [],
    }, "travel_agent");
    expect(out.departureCity).toBe("Bengaluru");
    expect(out.rooms).toBe(2);
    expect(out.hotelStarPreference).toBe("3");
    expect(out.nationality).toBe("India");
    expect(out.landOnly).toBe(true);
    expect(out.estimatedBookingDate).toBe("2026-11-15");
    expect(out.tripCities).toEqual(basics.tripCities);
    expect(out.internalNotes).toBeUndefined();
    expect(out.totalNetCost).toBeUndefined();
    expect(out.grossProfit).toBeUndefined();
  });
});

describe("Module 01A — quote-level rooms vs hotel-line pricing", () => {
  it("pricing continues to multiply hotel-line rooms × nights (not quote rooms alone)", () => {
    const tax: TaxRuleInput = {
      id: "tax-1",
      name: "GST",
      rate: 0,
      method: "EXCLUSIVE",
      active: true,
    };
    const priced = pricePackage(
      {
        hotels: [{
          source: "CONTRACTED_PRODUCT",
          productType: "HOTEL",
          rooms: 3,
          rateSnapshot: {
            contractedCost: 1000,
            currency: "INR",
            rateUnit: "PER_ROOM_NIGHT",
            frozen: true,
          },
        }],
      },
      {
        currency: "INR",
        nights: 2,
        adults: 2,
        children: 0,
        infants: 0,
        trevioMarkup: { type: "Fixed", value: 0 },
        agentMarkup: { type: "Fixed", value: 0 },
        taxRule: tax,
      },
    );
    // Hotel-line rooms (3) × context nights (2) × unit (1000) — quote-level rooms are irrelevant here.
    expect(priced.contractedCost).toBe(6000);
  });
});
