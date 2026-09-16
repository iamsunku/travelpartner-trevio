import { describe, expect, it } from "vitest";
import {
  assertNoProviderSecrets,
  flightLineFromContractedProduct,
  flightLineFromSearchResult,
  manualFlightTemplate,
  publicFlightSearchResult,
} from "../lib/flight-quote.js";
import { pricePackage } from "../lib/pricing.js";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { buildVisaCatalogueRecommendation, visaJsonFromRecommendation } from "../lib/visa-recommendation.js";
import { findApplicableContractedRate } from "../lib/contracted-rates.js";
import { generateFlights } from "../lib/mock-data.js";

const ctx = {
  adults: 2,
  children: 0,
  infants: 0,
  travelStartDate: "2026-10-10",
  travelEndDate: "2026-10-14",
  currency: "INR",
  trevioMarkup: { type: "Percentage" as const, value: 0 },
  agentMarkup: { type: "Fixed" as const, value: 0 },
  taxRate: 0,
};

describe("phase 12 flight sources → quotation lines", () => {
  it("A. Amadeus/search result maps into quotation flight with duration/baggage/fare", () => {
    const search = publicFlightSearchResult({
      id: "am1",
      airline: "IndiGo",
      flightNumber: "6E123",
      origin: "BOM",
      destination: "DXB",
      departTime: "09:00",
      arriveTime: "11:30",
      duration: "3h 30m",
      baggage: "1 × 23kg",
      cabin: "Economy",
      price: 18500,
      currency: "INR",
      seatsLeft: 5,
    });
    const line = flightLineFromSearchResult(search, { travelDate: "2026-10-10" });
    expect(line.source).toBe("AMADEUS_API");
    expect(line.duration).toBe("3h 30m");
    expect(line.baggage).toBe("1 × 23kg");
    expect(line.fare).toBe(18500);
    expect(line.from).toBe("BOM");
  });

  it("B. Manual flight template supports required fields", () => {
    const line = manualFlightTemplate();
    expect(line.source).toBe("MANUAL");
    for (const key of ["airline", "flightNumber", "from", "to", "duration", "baggage", "cabinClass", "pnr", "remarks", "currency", "selfBooked"]) {
      expect(Object.prototype.hasOwnProperty.call(line, key)).toBe(true);
    }
    expect(line.costPrice).toBeUndefined();
    expect(line.sellingPrice).toBeUndefined();
    expect(line.fare).toBeUndefined();
  });

  it("C. Contracted flight product maps with productId + cost/selling", () => {
    const line = flightLineFromContractedProduct(
      {
        id: "fp1",
        airline: "Emirates",
        flightNumber: "EK501",
        origin: "BOM",
        destinationAirport: "DXB",
        duration: "3h 20m",
        baggage: "2 × 30kg",
        cabinClass: "Economy",
        currency: "INR",
      },
      { travelDate: "2026-10-10", rateId: "r1", contractedCost: 22000, displayPrice: 28000 },
    );
    expect(line.source).toBe("CONTRACTED_PRODUCT");
    expect(line.productId).toBe("fp1");
    expect(line.costPrice).toBe(22000);
    expect(line.sellingPrice).toBe(28000);
  });

  it("D. Each flight source reaches Phase 3 pricing pipeline", () => {
    const api = pricePackage(
      { flights: [{ source: "AMADEUS_API", fare: 15000, airline: "TG" }] },
      { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } },
    );
    const manual = pricePackage(
      { flights: [{ source: "MANUAL", costPrice: 9000, airline: "6E" }] },
      { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } },
    );
    const contracted = pricePackage(
      {
        flights: [{
          source: "CONTRACTED_PRODUCT",
          productType: "FLIGHT",
          rateSnapshot: { contractedCost: 20000, currency: "INR", frozen: true },
        }],
      },
      { ...ctx, adults: 1, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } },
    );
    expect(api.contractedCost).toBe(15000);
    expect(manual.contractedCost).toBe(9000);
    expect(contracted.contractedCost).toBe(20000);
  });

  it("G. Multi-package flights stay separated", () => {
    const pkgA = { name: "A", flights: [flightLineFromSearchResult({ price: 10000, airline: "6E" })] };
    const pkgB = { name: "B", flights: [flightLineFromSearchResult({ price: 20000, airline: "AI" })] };
    expect((pkgA.flights[0] as { fare: number }).fare).not.toBe((pkgB.flights[0] as { fare: number }).fare);
  });
});

describe("phase 12 security", () => {
  it("A-B. agent cannot see contracted flight cost / supplier on quote", () => {
    const quote = {
      packages: [{
        flights: [{
          source: "CONTRACTED_PRODUCT",
          productId: "fp1",
          costPrice: 22000,
          contractedCost: 22000,
          supplier: "Secret Air",
          supplierId: "sup-1",
          sellingPrice: 28000,
          fare: 28000,
          airline: "EK",
        }],
      }],
      totalNetCost: 22000,
      grossProfit: 6000,
      internalNotes: "hide me",
    };
    const agent = sanitizeQuotationForRole(quote, "travel_agent");
    const flight = (agent.packages as Array<{ flights: Array<Record<string, unknown>> }>)[0].flights[0];
    expect(flight.costPrice).toBeUndefined();
    expect(flight.contractedCost).toBeUndefined();
    expect(flight.supplier).toBeUndefined();
    expect(flight.supplierId).toBeUndefined();
    expect(agent.totalNetCost).toBeUndefined();
    expect(agent.internalNotes).toBeUndefined();
  });

  it("C-F-M. customer sees selling only; no internal catalogue cost", () => {
    const quote = {
      packages: [{ flights: [{ sellingPrice: 28000, fare: 28000, costPrice: 22000, airline: "EK" }] }],
      total: 28000,
      totalNetCost: 22000,
    };
    const customer = sanitizeQuotationForRole(quote, "customer");
    const flight = (customer.packages as Array<{ flights: Array<Record<string, unknown>> }>)[0].flights[0];
    expect(flight.costPrice).toBeUndefined();
    expect(flight.sellingPrice ?? flight.fare).toBeTruthy();
  });

  it("I. provider credentials never appear in public search payload", () => {
    const flights = generateFlights("BOM", "DEL", 2).map((f) => publicFlightSearchResult(f as unknown as Record<string, unknown>));
    expect(assertNoProviderSecrets({ flights, provider: "mock" })).toBe(true);
    expect(assertNoProviderSecrets({ flights, flightApiSecret: "SHOULD_NOT" })).toBe(false);
  });

  it("H. invalid contracted rate is not silently applicable (boundary helper)", () => {
    const rates = [
      { id: "r1", active: true, validFrom: "2026-01-01", validTo: "2026-01-31", contractedCost: 1000, metadata: {} },
    ];
    expect(findApplicableContractedRate(rates, "2025-12-31").status).toBe("NO_VALID_RATE");
    expect(findApplicableContractedRate(rates, "2026-01-01").status).toBe("OK");
    expect(findApplicableContractedRate(rates, "2026-01-31").status).toBe("OK");
    expect(findApplicableContractedRate(rates, "2026-02-01").status).toBe("NO_VALID_RATE");
  });
});

describe("phase 12 visa catalogue recommendation", () => {
  it("recommendation is catalogue-based with disclaimer (not immigration advice)", () => {
    const rec = buildVisaCatalogueRecommendation({
      name: "Dubai",
      country: "UAE",
      visaRequired: true,
      visaDetails: "Tourist visa typically required for Indian passport holders.",
    });
    expect(rec.source).toBe("destination_catalogue");
    expect(rec.disclaimer.toLowerCase()).toMatch(/not legal|immigration/);
    const json = visaJsonFromRecommendation(rec);
    expect(json.enabled).toBe(true);
    expect(json.catalogueRecommendation).toBeTruthy();
  });
});
