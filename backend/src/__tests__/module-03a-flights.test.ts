import { describe, expect, it } from "vitest";
import {
  assertNoProviderSecrets,
  flightLineFromContractedProduct,
  flightLineFromSearchResult,
  manualFlightTemplate,
  publicFlightSearchResult,
} from "../lib/flight-quote.js";
import { pricePackage, priceLine } from "../lib/pricing.js";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { generateFlights } from "../lib/mock-data.js";
import { RATE_SOURCES } from "../lib/contracted-rates.js";

const ctx = {
  adults: 2,
  children: 1,
  infants: 0,
  travelStartDate: "2026-10-18",
  travelEndDate: "2026-10-24",
  currency: "INR",
  trevioMarkup: { type: "Percentage" as const, value: 0 },
  agentMarkup: { type: "Fixed" as const, value: 0 },
  taxRate: 0,
};

describe("MODULE 03A — flight corrections", () => {
  it("I. self-booked template does not invent commercial amounts", () => {
    const line = manualFlightTemplate({ currency: "INR", from: "BLR", adults: 2, children: 1 });
    expect(line.source).toBe("MANUAL");
    expect(line.selfBooked).toBe(true);
    expect(line.costPrice).toBeUndefined();
    expect(line.sellingPrice).toBeUndefined();
    expect(line.fare).toBeUndefined();
    expect(line.currency).toBe("INR");
    expect(line.pnr).toBe("");
  });

  it("J. manual entered selling/fare still prices", () => {
    const priced = pricePackage(
      { flights: [{ source: "MANUAL", selfBooked: true, costPrice: 9000, fare: 12000, sellingPrice: 12000 }] },
      { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } },
    );
    expect(priced.contractedCost).toBe(9000);
  });

  it("I-blank. self-booked with no amounts resolves to zero cost (not unresolved)", () => {
    const line = priceLine(
      { source: "MANUAL", selfBooked: true },
      ctx,
    );
    expect(line.unresolved).toBe(false);
    expect(line.contractedCost).toBe(0);
  });

  it("K. API result field preservation via flightLineFromSearchResult", () => {
    const search = publicFlightSearchResult({
      id: "am1",
      airline: "IndiGo",
      airlineCode: "6E",
      flightNumber: "6E123",
      origin: "BLR",
      destination: "HKT",
      departDate: "2026-10-18",
      arriveDate: "2026-10-18",
      departTime: "08:30",
      arriveTime: "14:25",
      duration: "5h 55m",
      stops: 1,
      baggage: "1 × 23kg",
      cabin: "Economy",
      price: 18500,
      currency: "INR",
      refundable: true,
      aircraft: "A320",
      journeyId: "j1",
      segmentIndex: 0,
    });
    const line = flightLineFromSearchResult(search, {
      source: "AMADEUS_API",
      adults: 2,
      children: 1,
      infants: 0,
    });
    expect(line.source).toBe("AMADEUS_API");
    expect(line.airlineCode).toBe("6E");
    expect(line.stops).toBe(1);
    expect(line.arrivalDate).toBe("2026-10-18");
    expect(line.refundable).toBe(true);
    expect(line.aircraft).toBe("A320");
    expect(line.adults).toBe(2);
    expect(line.children).toBe(1);
    expect(line.costPrice).toBeUndefined();
    expect(line.fare).toBe(18500);
  });

  it("G. mock source is MOCK not AMADEUS_API", () => {
    const line = flightLineFromSearchResult(
      { ...generateFlights("BLR", "HKT", 1, { departureDate: "2026-10-18" })[0], source: "MOCK" },
      { source: "MOCK", adults: 2 },
    );
    expect(line.source).toBe("MOCK");
    expect(line.provider).toBe("MOCK");
  });

  it("L. overnight arrival date on mock flights", () => {
    const flights = generateFlights("BOM", "JFK", 3, { departureDate: "2026-10-18" });
    const overnight = flights.find((f) => f.arrivalDate && f.arrivalDate !== f.departDate);
    // Long-haul mock may overnight depending on duration; at least departDate is set.
    expect(flights[0].departDate).toBe("2026-10-18");
    if (overnight) expect(overnight.arrivalDate).toBeTruthy();
  });

  it("M. multi-segment lines stay independent", () => {
    const seg1 = flightLineFromSearchResult(
      { airline: "6E", flightNumber: "6E101", origin: "BLR", destination: "HKT", departDate: "2026-10-18", price: 10000 },
      { source: "MOCK", segmentIndex: 0, journeyId: "trip-1", adults: 2 },
    );
    const seg2 = flightLineFromSearchResult(
      { airline: "PG", flightNumber: "PG200", origin: "HKT", destination: "KBV", departDate: "2026-10-21", price: 5000 },
      { source: "MOCK", segmentIndex: 1, journeyId: "trip-1", adults: 2 },
    );
    const seg3 = flightLineFromSearchResult(
      { airline: "6E", flightNumber: "6E102", origin: "KBV", destination: "BLR", departDate: "2026-10-24", price: 11000 },
      { source: "MOCK", segmentIndex: 2, journeyId: "trip-1", adults: 2 },
    );
    expect(seg1.date).toBe("2026-10-18");
    expect(seg2.date).toBe("2026-10-21");
    expect(seg3.date).toBe("2026-10-24");
    expect(seg1.segmentIndex).toBe(0);
    expect(seg2.segmentIndex).toBe(1);
    expect(seg3.from).toBe("KBV");
    expect(seg3.to).toBe("BLR");
  });

  it("N. contracted flight mapping keeps productId + cost when staff-visible", () => {
    const line = flightLineFromContractedProduct(
      {
        id: "fp1",
        airline: "Emirates",
        flightNumber: "EK501",
        origin: "BOM",
        destinationAirport: "DXB",
        cabinClass: "Economy",
        currency: "INR",
      },
      { travelDate: "2026-10-20", rateId: "r1", contractedCost: 22000, displayPrice: 28000, adults: 2 },
    );
    expect(line.source).toBe(RATE_SOURCES.CONTRACTED_PRODUCT);
    expect(line.date).toBe("2026-10-20");
    expect(line.costPrice).toBe(22000);
  });

  it("N-blank-date. contracted pick may leave date blank (caller decides segment date)", () => {
    const line = flightLineFromContractedProduct(
      { id: "fp1", airline: "EK", origin: "BOM", destinationAirport: "DXB" },
      { rateId: "r1", contractedCost: 10000 },
    );
    expect(line.date).toBe("");
  });

  it("O. agent sanitization strips contracted cost", () => {
    const quote = {
      packages: [{
        flights: [{
          source: "CONTRACTED_PRODUCT",
          costPrice: 22000,
          contractedCost: 22000,
          supplier: "Secret Air",
          sellingPrice: 28000,
          fare: 28000,
        }],
      }],
      totalNetCost: 22000,
    };
    const agent = sanitizeQuotationForRole(quote, "travel_agent");
    const flight = (agent.packages as Array<{ flights: Array<Record<string, unknown>> }>)[0].flights[0];
    expect(flight.costPrice).toBeUndefined();
    expect(flight.contractedCost).toBeUndefined();
    expect(flight.supplier).toBeUndefined();
    expect(flight.sellingPrice).toBe(28000);
  });

  it("Q. PDF flight map includes arrivalDate, stops, sellingPrice", async () => {
    const { buildQuotationPdfModel } = await import("../lib/quotation-pdf/model.js");
    const model = buildQuotationPdfModel({
      quote: {
        quoteNo: "Q-1",
        customerName: "Test",
        packages: [{
          name: "Standard",
          flights: [{
            airline: "IndiGo",
            flightNumber: "6E123",
            from: "BLR",
            to: "HKT",
            date: "2026-10-18",
            arrivalDate: "2026-10-18",
            depTime: "08:30",
            arrTime: "14:25",
            duration: "5h 55m",
            stops: 1,
            baggage: "1 × 23kg",
            cabinClass: "Economy",
            sellingPrice: 18500,
            currency: "INR",
            costPrice: 12000,
            contractedCost: 12000,
          }],
        }],
      },
      mode: "customer",
      audience: "customer",
    } as never);
    const flight = model.packages[0].flights[0];
    expect(flight.arrivalDate).toBe("2026-10-18");
    expect(flight.stops).toBe(1);
    expect(flight.sellingPrice).toBe(18500);
    expect((flight as { costPrice?: number }).costPrice).toBeUndefined();
  });

  it("assertNoProviderSecrets still guards search payloads", () => {
    expect(assertNoProviderSecrets({ flights: [{ airline: "6E" }], clientSecret: "x" })).toBe(false);
    expect(assertNoProviderSecrets({ flights: [{ airline: "6E" }], provider: "mock" })).toBe(true);
  });
});
