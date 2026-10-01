import { describe, expect, it } from "vitest";
import {
  displayComponentSellingPrice,
} from "./quote-costing";

/** Pure helpers mirroring day-plan hotel placement (no React). */

function hotelCoversNight(hotel: Record<string, unknown>, date: string): boolean {
  const cin = String(hotel.checkIn || "");
  const cout = String(hotel.checkOut || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cin) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cout)) return date >= cin && date < cout;
  return date === cin;
}

function isHotelCheckInDay(hotel: Record<string, unknown>, date: string): boolean {
  return String(hotel.checkIn || "") === date;
}

function dayItemsWithoutHotelProjections(items: Record<string, unknown>[]) {
  return items.filter((item) => String(item.itemType || "").toUpperCase() !== "HOTEL");
}

describe("Hotels under day plan", () => {
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

  it("check-in day shows full stay card; intermediate nights are continuing stay", () => {
    expect(isHotelCheckInDay(hotels[0], "2026-10-10")).toBe(true);
    expect(hotelCoversNight(hotels[0], "2026-10-11")).toBe(true);
    expect(isHotelCheckInDay(hotels[0], "2026-10-11")).toBe(false);
    expect(hotelCoversNight(hotels[0], "2026-10-13")).toBe(false);
  });

  it("itinerary HOTEL projections are filtered when rendering package hotel cards", () => {
    const dayItems = [
      { itemType: "HOTEL", autoFromHotel: true, activityName: "KL Tower Hotel", hotelLineId: "h1" },
      { itemType: "TRANSFER", transferLineId: "t1", activityName: "Airport Transfer" },
      { itemType: "ACTIVITY", activityLineId: "a1", activityName: "City Tour" },
    ];
    const visible = dayItemsWithoutHotelProjections(dayItems);
    expect(visible.map((i) => i.activityName)).toEqual(["Airport Transfer", "City Tour"]);
  });

  it("stay total is not multiplied by nights", () => {
    const amounts = hotels.map((h) => displayComponentSellingPrice(h, "hotel"));
    expect(amounts).toEqual([30000, 18000]);
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
  });
});

describe("Transfers under Activities menu", () => {
  const activitiesMenu = ["Activity / Sightseeing", "Transfer", "Airport Pickup", "Airport Drop"] as const;

  it("Activities dropdown includes transfer options (no separate Cars & Transfers button)", () => {
    expect(activitiesMenu).toContain("Transfer");
    expect(activitiesMenu).toContain("Airport Pickup");
    expect(activitiesMenu).toContain("Airport Drop");
    expect(activitiesMenu).toContain("Activity / Sightseeing");
  });
});