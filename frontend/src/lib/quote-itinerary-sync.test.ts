import { describe, expect, it } from "vitest";
import { buildTripCityStayWindows } from "./quote-trip-stays";
import {
  buildTripNightDates,
  formatItineraryDate,
  syncPackageItinerary,
} from "./quote-itinerary-sync";

const start = "2026-10-18";

describe("MODULE 04A — itinerary sync", () => {
  it("1–3. multi-city night dates without extra checkout day", () => {
    const windows = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 3, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
        { city: "Bangkok", nights: 2, order: 3 },
      ],
      start,
    );
    const nights = buildTripNightDates(windows, [], start);
    expect(nights.map((n) => `${n.date}:${n.city}`)).toEqual([
      "2026-10-18:Phuket",
      "2026-10-19:Phuket",
      "2026-10-20:Phuket",
      "2026-10-21:Krabi",
      "2026-10-22:Krabi",
      "2026-10-23:Bangkok",
      "2026-10-24:Bangkok",
    ]);
    expect(nights.some((n) => n.date === "2026-10-25")).toBe(false);
  });

  it("4–6. hotel days + city night change + no Phuket spill", () => {
    const windows = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 3, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
      start,
    );
    const hotels = [
      {
        lineId: "h1",
        hotelName: "Patong Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-21",
        nights: 3,
        roomType: "Deluxe",
        mealPlan: "Breakfast",
        rooms: 1,
      },
      {
        lineId: "h2",
        hotelName: "Ao Nang Inn",
        tripCity: "Krabi",
        checkIn: "2026-10-21",
        checkOut: "2026-10-23",
        nights: 2,
        mealPlan: "Breakfast",
      },
    ];
    const days = syncPackageItinerary([], { hotels, stayWindows: windows, travelStartDate: start });
    expect(days).toHaveLength(5);
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(days.map((d) => d.city)).toEqual(["Phuket", "Phuket", "Phuket", "Krabi", "Krabi"]);
    const d21 = days.find((d) => d.date === "2026-10-21")!;
    const hotelItems = (d21.items as Record<string, unknown>[]).filter((i) => i.autoFromHotel);
    expect(hotelItems.some((i) => String(i.activityName).includes("checkout"))).toBe(true);
    expect(hotelItems.some((i) => String(i.activityName).includes("check-in"))).toBe(true);

    const windows2 = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 4, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
      start,
    );
    const hotels2 = [
      { ...hotels[0], checkOut: "2026-10-22", nights: 4 },
      { ...hotels[1], checkIn: "2026-10-22", checkOut: "2026-10-24", nights: 2 },
    ];
    const days2 = syncPackageItinerary(days, { hotels: hotels2, stayWindows: windows2, travelStartDate: start });
    expect(days2).toHaveLength(6);
    expect(days2.filter((d) => d.city === "Phuket")).toHaveLength(4);
  });

  it("7–10. flight / transfer / activity / meal on dates + stops", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 3, order: 1 }], start);
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      flights: [{
        lineId: "f1",
        airline: "IndiGo",
        airlineCode: "6E",
        flightNumber: "6E123",
        from: "BLR",
        to: "HKT",
        date: "2026-10-18",
        depTime: "08:30",
        arrTime: "14:25",
        duration: "5h 55m",
        stops: 1,
        baggage: "23kg",
        cabinClass: "Economy",
      }],
      transfers: [{
        lineId: "t1",
        transferType: "Airport Transfer",
        date: "2026-10-18",
        pickup: "Phuket Airport",
        drop: "Patong Bay Hotel",
        pickupTime: "15:00",
        vehicleType: "Private Car",
      }],
      activities: [{
        lineId: "a1",
        activityName: "Phi Phi Island Tour",
        date: "2026-10-20",
        city: "Phuket",
        duration: "Full day",
        adults: 2,
      }],
      meals: [{
        lineId: "m1",
        mealType: "Breakfast",
        date: "2026-10-19",
        city: "Phuket",
        adults: 2,
      }],
    });
    const d18 = days.find((d) => d.date === "2026-10-18")!;
    const types = (d18.items as Record<string, unknown>[]).map((i) => i.itemType);
    expect(types).toContain("FLIGHT");
    expect(types).toContain("TRANSFER");
    const flight = (d18.items as Record<string, unknown>[]).find((i) => i.itemType === "FLIGHT")!;
    expect(String(flight.description)).toContain("stop");
    expect(days.find((d) => d.date === "2026-10-20")!.items as Record<string, unknown>[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemType: "ACTIVITY" })]),
    );
    expect(days.find((d) => d.date === "2026-10-19")!.items as Record<string, unknown>[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemType: "MEAL" })]),
    );
  });

  it("11–16. same-day multi-service + dedupe on regenerate", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 2, order: 1 }], start);
    const input = {
      stayWindows: windows,
      travelStartDate: start,
      hotels: [{
        lineId: "h1",
        hotelName: "Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-20",
        nights: 2,
      }],
      flights: [{ lineId: "f1", from: "BLR", to: "HKT", date: "2026-10-18", airline: "6E", flightNumber: "6E1", depTime: "08:30" }],
      transfers: [{ lineId: "t1", transferType: "Airport", date: "2026-10-18", pickup: "Airport", drop: "Hotel" }],
    };
    const once = syncPackageItinerary([], input);
    const twice = syncPackageItinerary(once, input);
    const d18 = twice.find((d) => d.date === "2026-10-18")!;
    const autos = (d18.items as Record<string, unknown>[]).filter((i) =>
      i.autoFromFlight || i.autoFromTransfer || i.autoFromHotel);
    const keys = autos.map((i) => String(i.sourceKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("17–18. manual edit survival + regenerate safety", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 2, order: 1 }], start);
    const base = syncPackageItinerary([], {
      stayWindows: windows,
      hotels: [{
        lineId: "h1",
        hotelName: "Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-20",
        nights: 2,
      }],
      flights: [{ lineId: "f1", from: "BLR", to: "HKT", date: "2026-10-18", airline: "6E", flightNumber: "6E1" }],
    });
    const withManual = base.map((d) => {
      if (d.date !== "2026-10-18") return d;
      return {
        ...d,
        items: [
          ...(d.items as Record<string, unknown>[]),
          { activityName: "Client welcome drink", description: "Keep me", itemType: "MANUAL" },
        ],
      };
    });
    // Simulate user editing auto flight description
    const edited = withManual.map((d) => ({
      ...d,
      items: (d.items as Record<string, unknown>[]).map((i) =>
        i.autoFromFlight ? { ...i, description: "Edited flight note", remarks: "VIP" } : i),
    }));
    const regenerated = syncPackageItinerary(edited, {
      stayWindows: windows,
      hotels: [{
        lineId: "h1",
        hotelName: "Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-20",
        nights: 2,
      }],
      flights: [{ lineId: "f1", from: "BLR", to: "HKT", date: "2026-10-18", airline: "6E", flightNumber: "6E1" }],
    });
    const d18 = regenerated.find((d) => d.date === "2026-10-18")!;
    const items = d18.items as Record<string, unknown>[];
    expect(items.some((i) => i.itemType === "MANUAL" && i.activityName === "Client welcome drink")).toBe(true);
    const flight = items.find((i) => i.autoFromFlight)!;
    expect(flight.description).toBe("Edited flight note");
    expect(flight.remarks).toBe("VIP");
  });

  it("19. formatItineraryDate", () => {
    expect(formatItineraryDate("2026-10-18")).toMatch(/18/);
    expect(formatItineraryDate("2026-10-18")).toMatch(/2026/);
  });

  it("legacy days without type still sync", () => {
    const existing = [{
      day: 1,
      title: "Day 1",
      city: "Phuket",
      date: "2026-10-18",
      items: [{ activityName: "Old manual", description: "legacy" }],
    }];
    const next = syncPackageItinerary(existing, {
      stayWindows: buildTripCityStayWindows([{ city: "Phuket", nights: 1, order: 1 }], start),
      flights: [{ lineId: "f1", from: "BLR", to: "HKT", date: "2026-10-18", airline: "6E", flightNumber: "1" }],
    });
    const items = next[0].items as Record<string, unknown>[];
    expect(items.some((i) => i.activityName === "Old manual")).toBe(true);
    expect(items.some((i) => i.autoFromFlight)).toBe(true);
  });
});
