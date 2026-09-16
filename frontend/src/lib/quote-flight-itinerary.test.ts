/**
 * Lightweight unit checks for flight → itinerary merge (MODULE 03A).
 * Run via: npx vitest run src/lib/quote-flight-itinerary.test.ts (if vitest configured)
 * or import from Node tooling.
 */
import { describe, expect, it } from "vitest";
import { mergeFlightsIntoItinerary, stripAutoFlightItems } from "./quote-flight-itinerary";

describe("quote-flight-itinerary", () => {
  it("P. merges flights onto matching dates without duplicating", () => {
    const hotelDays = [
      {
        day: 1,
        title: "Day 1 — Arrival · Phuket",
        city: "Phuket",
        date: "2026-10-18",
        autoFromHotel: true,
        items: [{ activityName: "Arrival & hotel check-in", description: "Stay at Hotel" }],
      },
      {
        day: 2,
        title: "Day 2 — Phuket",
        city: "Phuket",
        date: "2026-10-19",
        autoFromHotel: true,
        items: [{ activityName: "Sightseeing / leisure", description: "Stay at Hotel" }],
      },
    ];
    const flights = [
      {
        airline: "IndiGo",
        flightNumber: "6E123",
        from: "BLR",
        to: "HKT",
        date: "2026-10-18",
        depTime: "08:30",
        arrTime: "14:25",
        source: "MOCK",
      },
      {
        airline: "PG",
        flightNumber: "PG200",
        from: "HKT",
        to: "KBV",
        date: "2026-10-21",
        depTime: "10:00",
        arrTime: "11:10",
        source: "MOCK",
      },
    ];
    const once = mergeFlightsIntoItinerary(hotelDays, flights);
    const twice = mergeFlightsIntoItinerary(once, flights);
    const day18 = twice.find((d) => d.date === "2026-10-18")!;
    const flightItems = (day18.items as Array<Record<string, unknown>>).filter((i) => i.autoFromFlight);
    expect(flightItems).toHaveLength(1);
    expect(String(flightItems[0].activityName)).toContain("BLR");
    expect(twice.some((d) => d.date === "2026-10-21")).toBe(true);
    const stripped = stripAutoFlightItems(twice);
    expect(stripped.every((d) => !(d.items as Array<Record<string, unknown>>).some((i) => i.autoFromFlight))).toBe(true);
  });
});
