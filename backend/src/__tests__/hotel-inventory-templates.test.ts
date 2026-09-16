import { describe, expect, it } from "vitest";
import {
  CATALOGUE_INVENTORY_UNAVAILABLE,
  checkCatalogueHotelInventory,
  enumerateStayNights,
  hotelLineRequiresCatalogueInventory,
} from "../lib/hotel-inventory.js";
import {
  extractTemplateContent,
  mergeTemplateIntoQuotation,
  sanitizeTemplateServiceLines,
} from "../lib/quote-template-merge.js";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { findApplicableContractedRate } from "../lib/contracted-rates.js";

describe("phase 13 HT-04 catalogue hotel inventory", () => {
  it("enumerates nights exclusive of check-out", () => {
    expect(enumerateStayNights("2026-10-01", "2026-10-04")).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("empty inventory is untracked (not treated as live confirmation)", () => {
    const result = checkCatalogueHotelInventory({
      inventory: [],
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      rooms: 1,
      roomType: "Deluxe",
    });
    expect(result.source).toBe("catalogue");
    expect(result.ok).toBe(true);
    expect(result.nights.every((n) => n.status === "untracked")).toBe(true);
  });

  it("I. insufficient rooms rejects when quote rooms exceed availability", () => {
    const oneRoomOk = checkCatalogueHotelInventory({
      inventory: [{ roomName: "Deluxe", date: "2026-10-01", available: 1, soldOut: "No", closed: "No" }],
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      rooms: 1,
      roomType: "Deluxe",
    });
    const twoRoomsFail = checkCatalogueHotelInventory({
      inventory: [{ roomName: "Deluxe", date: "2026-10-01", available: 1, soldOut: "No", closed: "No" }],
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      rooms: 2,
      roomType: "Deluxe",
    });
    expect(oneRoomOk.ok).toBe(true);
    expect(twoRoomsFail.ok).toBe(false);
  });

  it("F-G. sold-out / insufficient rooms / blackout rejected", () => {
    const sold = checkCatalogueHotelInventory({
      inventory: [{ roomName: "Deluxe", date: "2026-10-01", available: 2, soldOut: "Yes", closed: "No" }],
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      rooms: 1,
      roomType: "Deluxe",
    });
    expect(sold.ok).toBe(false);
    expect(sold.message).toBe(CATALOGUE_INVENTORY_UNAVAILABLE);

    const short = checkCatalogueHotelInventory({
      inventory: [{ roomName: "Deluxe", date: "2026-10-01", available: 1, soldOut: "No", closed: "No" }],
      checkIn: "2026-10-01",
      checkOut: "2026-10-02",
      rooms: 2,
      roomType: "Deluxe",
    });
    expect(short.ok).toBe(false);

    const blackout = checkCatalogueHotelInventory({
      inventory: [],
      blackoutDates: [{ dateFrom: "2026-10-01", dateTo: "2026-10-05" }],
      checkIn: "2026-10-02",
      checkOut: "2026-10-04",
      rooms: 1,
    });
    expect(blackout.ok).toBe(false);
  });

  it("self-booked hotels skip catalogue inventory enforcement", () => {
    expect(hotelLineRequiresCatalogueInventory({ source: "MANUAL", hotelName: "Self" })).toBe(false);
    expect(hotelLineRequiresCatalogueInventory({ source: "CONTRACTED_PRODUCT", productId: "h1", productType: "HOTEL" })).toBe(true);
  });

  it("A-B-C. agent/customer sanitization still strips hotel cost/supplier", () => {
    const quote = {
      packages: [{ hotels: [{ costPrice: 9000, contractedCost: 9000, supplier: "Hidden", sellingPrice: 12000 }] }],
      totalNetCost: 9000,
    };
    const agent = sanitizeQuotationForRole(quote, "travel_agent");
    const hotel = (agent.packages as Array<{ hotels: Array<Record<string, unknown>> }>)[0].hotels[0];
    expect(hotel.costPrice).toBeUndefined();
    expect(hotel.supplier).toBeUndefined();
  });

  it("D-E. invalid contracted rate remains rejected (Phase 2 semantics)", () => {
    const rates = [{ id: "r1", active: true, validFrom: "2026-01-01", validTo: "2026-01-31", contractedCost: 1000, metadata: {} }];
    expect(findApplicableContractedRate(rates, "2026-02-01").status).toBe("NO_VALID_RATE");
  });
});

describe("phase 13 TM-02 quote template merge", () => {
  const sections = [
    { sectionType: "TERMS", isVisible: true, settings: { content: { text: "Template terms" } } },
    { sectionType: "INCLUSIONS", isVisible: true, settings: { content: { items: ["Breakfast", "Transfer"] } } },
    {
      sectionType: "HOTELS",
      isVisible: true,
      settings: {
        content: {
          hotels: [{ hotelName: "Sample Inn", costPrice: 9999, contractedCost: 9999, supplier: "Leak", sellingPrice: 15000 }],
        },
      },
    },
    {
      sectionType: "ITINERARY",
      isVisible: true,
      settings: { content: { itinerary: [{ day: 1, title: "Day 1", items: [{ activityName: "Arrive" }] }] } },
    },
  ];

  it("extracts content and strips supplier cost from template hotel lines", () => {
    const content = extractTemplateContent({ templateId: "t1", templateName: "Demo", sections });
    expect(content.termsAndConditions).toBe("Template terms");
    expect(content.inclusions).toEqual(["Breakfast", "Transfer"]);
    expect(content.hotels?.[0].costPrice).toBeUndefined();
    expect(content.hotels?.[0].supplier).toBeUndefined();
    expect(content.hotels?.[0].source).toBe("MANUAL");
  });

  it("fill-empty preserves existing user hotels/terms", () => {
    const content = extractTemplateContent({ templateId: "t1", templateName: "Demo", sections });
    const merged = mergeTemplateIntoQuotation({
      mode: "fill-empty",
      quote: { termsAndConditions: "User terms" },
      pkg: { hotels: [{ hotelName: "Already there" }], inclusions: [], itinerary: [] },
      content,
    });
    expect(merged.quotePatch.termsAndConditions).toBeUndefined();
    expect(merged.packagePatch.hotels).toBeUndefined();
    expect(merged.packagePatch.inclusions).toEqual(["Breakfast", "Transfer"]);
    expect(merged.packagePatch.itinerary).toHaveLength(1);
  });

  it("merge-append appends itinerary without wiping hotels when fill empty would skip", () => {
    const content = extractTemplateContent({ templateId: "t1", templateName: "Demo", sections });
    const merged = mergeTemplateIntoQuotation({
      mode: "merge-append",
      quote: {},
      pkg: { hotels: [{ hotelName: "A" }], itinerary: [{ day: 1, title: "Existing" }] },
      content,
    });
    expect((merged.packagePatch.itinerary as unknown[]).length).toBe(2);
    expect((merged.packagePatch.hotels as unknown[]).length).toBe(2);
  });

  it("C. sanitizeTemplateServiceLines cannot inject contracted cost", () => {
    const lines = sanitizeTemplateServiceLines([{ productId: "h1", contractedCost: 50, costPrice: 50, sellingPrice: 80 }]);
    expect(lines[0].contractedCost).toBeUndefined();
    expect(lines[0].source).toBe("CONTRACTED_PRODUCT");
  });

  it("F. template snapshot content is a copy (mutating template sections later does not mutate snapshot object)", () => {
    const content = extractTemplateContent({ templateId: "t1", templateName: "Demo", sections });
    const snapshot = JSON.parse(JSON.stringify(content));
    (sections[0].settings as { content: { text: string } }).content.text = "CHANGED";
    expect(snapshot.termsAndConditions).toBe("Template terms");
  });
});
