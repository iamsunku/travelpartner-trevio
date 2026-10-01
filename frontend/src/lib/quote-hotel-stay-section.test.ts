import { describe, expect, it } from "vitest";
import {
  calcPackageCosting,
  displayComponentSellingPrice,
  isHotelStayPriceNight,
} from "./quote-costing";

/** Pure helpers mirroring Hotels & Stay section / day-card filters (no React). */

function hotelsForSection(hotels: Record<string, unknown>[]) {
  return hotels;
}

function dayItemsWithoutHotels(items: Record<string, unknown>[]) {
  return items.filter((item) => String(item.itemType || "").toUpperCase() !== "HOTEL");
}

describe("Hotels & Stay section restructuring", () => {
  const hotels = [
    {
      lineId: "h1",
      hotelName: "KL Tower Hotel",
      city: "Kuala Lumpur",
      checkIn: "2026-10-10",
      checkOut: "2026-10-13",
      nights: 3,
      roomType: "Deluxe",
      rooms: 1,
      mealPlan: "Breakfast",
      sellingPrice: 30000,
      imageUrl: "https://example.com/h1.jpg",
    },
    {
      lineId: "h2",
      hotelName: "Langkawi Resort",
      city: "Langkawi",
      checkIn: "2026-10-13",
      checkOut: "2026-10-15",
      nights: 2,
      roomType: "Superior",
      rooms: 1,
      sellingPrice: 18000,
    },
  ];

  it("section derives from packages[].hotels[] (one card per stay)", () => {
    const section = hotelsForSection(hotels);
    expect(section).toHaveLength(2);
    expect(section[0].lineId).toBe("h1");
    expect(section[1].lineId).toBe("h2");
  });

  it("day cards exclude HOTEL itinerary projections and hotel stay cards", () => {
    const dayItems = [
      { itemType: "HOTEL", autoFromHotel: true, activityName: "KL Tower Hotel", hotelLineId: "h1" },
      { itemType: "TRANSFER", transferLineId: "t1", activityName: "Airport Transfer" },
      { itemType: "ACTIVITY", activityLineId: "a1", activityName: "City Tour" },
    ];
    const visible = dayItemsWithoutHotels(dayItems);
    expect(visible.every((i) => String(i.itemType).toUpperCase() !== "HOTEL")).toBe(true);
    expect(visible.map((i) => i.activityName)).toEqual(["Airport Transfer", "City Tour"]);
  });

  it("multiple stays render separately with distinct stay totals (no × nights)", () => {
    const amounts = hotels.map((h) => displayComponentSellingPrice(h, "hotel"));
    expect(amounts).toEqual([30000, 18000]);
    // 3 nights must not become 90000
    expect(amounts[0]).not.toBe(30000 * 3);
  });

  it("self-booked / unpriced hotel does not fabricate ₹0", () => {
    const selfBooked = {
      lineId: "h3",
      hotelName: "Own booking",
      selfBooked: true,
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
    };
    expect(displayComponentSellingPrice(selfBooked, "hotel")).toBeNull();
    expect(displayComponentSellingPrice({ sellingPrice: 0 }, "hotel")).toBeNull();
  });

  it("remove / edit operate on hotels[] identity (lineId)", () => {
    let rows = [...hotels];
    rows = rows.map((h) => (h.lineId === "h1" ? { ...h, roomType: "Premier", mealPlan: "Half Board" } : h));
    expect(rows.find((h) => h.lineId === "h1")?.roomType).toBe("Premier");
    rows = rows.filter((h) => h.lineId !== "h2");
    expect(rows).toHaveLength(1);
    expect(rows[0].lineId).toBe("h1");
  });

  it("hotel section display does not alter package costing totals", () => {
    const pkg = {
      hotels,
      flights: [],
      transfers: [],
      activities: [],
      meals: [],
      addOns: [],
      trevioMarkupValue: 0,
      adults: 2,
      children: 0,
    };
    const before = calcPackageCosting(pkg);
    void hotelsForSection(hotels).map((h) => displayComponentSellingPrice(h, "hotel"));
    const after = calcPackageCosting(pkg);
    expect(after.total).toBe(before.total);
    expect(after.services.find((s) => s.key === "hotels")?.sellingPrice).toBe(48000);
  });

  it("legacy isHotelStayPriceNight still documents stay-total once semantics", () => {
    expect(isHotelStayPriceNight(hotels[0], "2026-10-10")).toBe(true);
    expect(isHotelStayPriceNight(hotels[0], "2026-10-11")).toBe(false);
  });
});
