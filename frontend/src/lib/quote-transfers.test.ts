import { describe, expect, it } from "vitest";
import { buildTripCityStayWindows, hotelTransferLocations, selfBookedHotelTransferLocations } from "./quote-trip-stays";
import {
  defaultActivityDateForCity,
  isDateInCityStay,
  mergeAutoTransfers,
  suggestAutoTransfers,
} from "./quote-transfers";
import { syncPackageItinerary } from "./quote-itinerary-sync";

const start = "2026-10-18";

function multiCityWindows() {
  return buildTripCityStayWindows(
    [
      { city: "Phuket", nights: 3, order: 1 },
      { city: "Krabi", nights: 2, order: 2 },
      { city: "Bangkok", nights: 2, order: 3 },
    ],
    start,
  );
}

describe("MODULE 05A — transfers & activities", () => {
  it("1–2. self-booked transfer/activity templates must not invent prices (shape contract)", () => {
    const transferTemplate = {
      source: "MANUAL",
      selfBooked: true,
      costPrice: undefined,
      sellingPrice: undefined,
    };
    const activityTemplate = {
      source: "MANUAL",
      selfBooked: true,
      adultRate: undefined,
      childRate: undefined,
      costPrice: undefined,
      sellingPrice: undefined,
    };
    expect(transferTemplate.costPrice).toBeUndefined();
    expect(transferTemplate.sellingPrice).toBeUndefined();
    expect(activityTemplate.adultRate).toBeUndefined();
    expect(activityTemplate.costPrice).toBeUndefined();
  });

  it("3–6. transfer fields flow to itinerary (pickupTime, pax, remarks, currency)", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 3, order: 1 }], start);
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      transfers: [{
        lineId: "t1",
        transferType: "Airport Pickup",
        date: "2026-10-18",
        pickup: "Phuket Airport",
        drop: "Patong Bay",
        pickupTime: "10:00",
        vehicleType: "Private Car",
        pax: 3,
        duration: "45 min",
        remarks: "Name board",
        voucher: "V-100",
        currency: "THB",
      }],
    });
    const item = (days.find((d) => d.date === "2026-10-18")!.items as Record<string, unknown>[])
      .find((i) => i.itemType === "TRANSFER")!;
    expect(item.pickupTime).toBe("10:00");
    expect(item.vehicle).toBe("Private Car");
    expect(item.duration).toBe("45 min");
    expect(item.remarks).toBe("Name board");
    expect(item.voucher).toBe("V-100");
    expect(String(item.description)).toContain("Vehicle: Private Car");
    expect(String(item.description)).toContain("3 max");
    expect(String(item.description)).not.toContain("pax");
  });

  it("airport pickup shows selected vehicle once with capacity max", () => {
    const windows = buildTripCityStayWindows([{ city: "Kuala Lumpur", nights: 2, order: 1 }], start);
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      transfers: [{
        lineId: "t-kl",
        transferType: "Airport Pickup",
        date: start,
        pickup: "Kuala Lumpur Airport",
        drop: "Trigo Kuala Lumpur",
        pickupTime: "11:09",
        vehicleType: "Van 10-seater",
        pax: 4,
        remarks: "Vehicle: Van 10-seater",
      }],
    });
    const item = (days.find((d) => d.date === start)!.items as Record<string, unknown>[])
      .find((i) => i.itemType === "TRANSFER")!;
    expect(String(item.description)).toBe(
      "Kuala Lumpur Airport → Trigo Kuala Lumpur · Vehicle: Van 10-seater · 10 max",
    );
    expect(item.remarks).toBe("");
    expect(item.vehicle).toBe("Van 10-seater");
  });

  it("transfer sync refreshes stale duplicate vehicle description", () => {
    const windows = buildTripCityStayWindows([{ city: "Kuala Lumpur", nights: 2, order: 1 }], start);
    const stale = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      transfers: [{
        lineId: "t-kl",
        transferType: "Airport Pickup",
        date: start,
        pickup: "Kuala Lumpur Airport",
        drop: "Trigo Kuala Lumpur",
        vehicleType: "Van 10-seater",
        pax: 4,
      }],
    });
    const staleItem = (stale[0].items as Record<string, unknown>[]).find((i) => i.itemType === "TRANSFER")!;
    staleItem.description = "Kuala Lumpur Airport → Trigo Kuala Lumpur · Van 10-seater · 4 pax · Vehicle: Van 10-seater";

    const refreshed = syncPackageItinerary(stale, {
      stayWindows: windows,
      travelStartDate: start,
      transfers: [{
        lineId: "t-kl",
        transferType: "Airport Pickup",
        date: start,
        pickup: "Kuala Lumpur Airport",
        drop: "Trigo Kuala Lumpur",
        vehicleType: "Van 10-seater",
        pax: 4,
      }],
    });
    const item = (refreshed[0].items as Record<string, unknown>[]).find((i) => i.itemType === "TRANSFER")!;
    expect(String(item.description)).toBe(
      "Kuala Lumpur Airport → Trigo Kuala Lumpur · Vehicle: Van 10-seater · 10 max",
    );
  });

  it("7–9. activity city + editable duration + city/date consistency helpers", () => {
    const windows = multiCityWindows();
    expect(defaultActivityDateForCity(windows, "Krabi")).toBe("2026-10-22");
    expect(isDateInCityStay(windows, "Krabi", "2026-10-22")).toBe(true);
    expect(isDateInCityStay(windows, "Krabi", "2026-10-18")).toBe(false);

    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      activities: [{
        lineId: "a1",
        activityName: "4 Islands Tour",
        city: "Krabi",
        date: "2026-10-22",
        duration: "Full Day",
        timeSlot: "08:00",
        adults: 2,
        children: 1,
        remarks: "Snorkel gear",
      }],
    });
    const day = days.find((d) => d.date === "2026-10-22")!;
    expect(day.city).toBe("Krabi");
    const act = (day.items as Record<string, unknown>[]).find((i) => i.itemType === "ACTIVITY")!;
    expect(act.activityName).toBe("4 Islands Tour");
    expect(act.duration).toBe("Full Day");
    expect(act.pickupTime).toBe("08:00");
    expect(String(act.description)).toContain("Krabi");
    expect(String(act.description)).toContain("2 adult");
  });

  it("10–11. catalogue + self-booked hotels as transfer endpoints", () => {
    const locs = hotelTransferLocations([
      { lineId: "c1", hotelName: "Patong Bay", city: "Phuket", tripCity: "Phuket", address: "123 Beach Rd", source: "CONTRACTED_PRODUCT" },
      { lineId: "s1", hotelName: "Guest House", city: "Krabi", tripCity: "Krabi", address: "Ao Nang 9", selfBooked: true, source: "MANUAL" },
      { lineId: "n1", hotelName: "No Address Hotel", city: "Bangkok", tripCity: "Bangkok", source: "CONTRACTED_PRODUCT" },
    ]);
    expect(locs).toHaveLength(3);
    expect(locs.find((l) => l.lineId === "c1")!.location).toBe("123 Beach Rd");
    expect(locs.find((l) => l.lineId === "s1")!.selfBooked).toBe(true);
    expect(locs.find((l) => l.lineId === "n1")!.location).toBe("No Address Hotel, Bangkok");

    const legacySelf = selfBookedHotelTransferLocations([
      { lineId: "s1", hotelName: "Guest House", city: "Krabi", address: "Ao Nang 9", selfBooked: true, source: "MANUAL" },
      { lineId: "c1", hotelName: "Patong Bay", city: "Phuket", address: "123 Beach Rd", source: "CONTRACTED_PRODUCT" },
    ]);
    expect(legacySelf).toHaveLength(1);
    expect(legacySelf[0].lineId).toBe("s1");
  });

  it("12–16. multi-city auto transfers + dedupe", () => {
    const windows = multiCityWindows();
    const hotels = [
      { lineId: "h1", hotelName: "Patong Bay", tripCity: "Phuket", city: "Phuket", address: "Patong" },
      { lineId: "h2", hotelName: "Ao Nang Inn", tripCity: "Krabi", city: "Krabi", address: "Ao Nang" },
      { lineId: "h3", hotelName: "Siam Hotel", tripCity: "Bangkok", city: "Bangkok", address: "Sukhumvit" },
    ];
    const suggestions = suggestAutoTransfers({ stayWindows: windows, hotels, pax: 3, currency: "THB" });
    expect(suggestions.map((s) => s.autoKey)).toEqual([
      "AUTO_ARRIVAL",
      "AUTO_CITY_TRANSFER_PHUKET_KRABI",
      "AUTO_CITY_TRANSFER_KRABI_BANGKOK",
      "AUTO_DEPARTURE",
    ]);
    expect(suggestions[0].date).toBe("2026-10-18");
    expect(suggestions[0].pickup).toBe("");
    expect(suggestions[0].drop).toBe("Patong");
    expect(suggestions[1].date).toBe("2026-10-21");
    expect(suggestions[3].date).toBe("2026-10-25");
    expect(suggestions.every((s) => (s as { costPrice?: number }).costPrice == null)).toBe(true);

    const once = mergeAutoTransfers([], suggestions);
    const twice = mergeAutoTransfers(once, suggestions);
    expect(twice).toHaveLength(4);
    expect(twice.filter((r) => r.autoKey === "AUTO_ARRIVAL")).toHaveLength(1);

    const withManual = mergeAutoTransfers([{
      transferType: "Airport Pickup",
      date: "2026-10-18",
      pickup: "",
      drop: "Patong",
      source: "MANUAL",
    }], suggestions);
    expect(withManual.filter((r) => r.autoKey === "AUTO_ARRIVAL")).toHaveLength(0);
    expect(withManual.some((r) => r.autoKey === "AUTO_DEPARTURE")).toBe(true);
  });

  it("17–19. activity + transfer itinerary same day without overwrite", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 3, order: 1 }], start);
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      hotels: [{
        lineId: "h1",
        hotelName: "Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-21",
        nights: 3,
        mealPlan: "Breakfast",
      }],
      transfers: [{
        lineId: "t1",
        transferType: "Hotel Transfer",
        date: "2026-10-20",
        pickup: "Bay",
        drop: "Pier",
        pickupTime: "07:30",
      }],
      activities: [{
        lineId: "a1",
        activityName: "Phi Phi Island Tour",
        city: "Phuket",
        date: "2026-10-20",
        duration: "Full Day",
        adults: 2,
      }],
    });
    const d20 = days.find((d) => d.date === "2026-10-20")!;
    const types = (d20.items as Record<string, unknown>[]).map((i) => i.itemType);
    expect(types).toContain("HOTEL");
    expect(types).toContain("TRANSFER");
    expect(types).toContain("ACTIVITY");
    const regenerated = syncPackageItinerary(days, {
      stayWindows: windows,
      travelStartDate: start,
      hotels: [{
        lineId: "h1",
        hotelName: "Bay",
        tripCity: "Phuket",
        checkIn: "2026-10-18",
        checkOut: "2026-10-21",
        nights: 3,
        mealPlan: "Breakfast",
      }],
      transfers: [{
        lineId: "t1",
        transferType: "Hotel Transfer",
        date: "2026-10-20",
        pickup: "Bay",
        drop: "Pier",
        pickupTime: "07:30",
      }],
      activities: [{
        lineId: "a1",
        activityName: "Phi Phi Island Tour",
        city: "Phuket",
        date: "2026-10-20",
        duration: "Full Day",
        adults: 2,
      }],
    });
    const items = regenerated.find((d) => d.date === "2026-10-20")!.items as Record<string, unknown>[];
    expect(items.filter((i) => i.itemType === "TRANSFER")).toHaveLength(1);
    expect(items.filter((i) => i.itemType === "ACTIVITY")).toHaveLength(1);
  });
});
