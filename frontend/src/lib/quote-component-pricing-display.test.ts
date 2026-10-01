import { describe, expect, it } from "vitest";
import {
  calcPackageCosting,
  displayComponentSellingPrice,
  findPackageLineById,
  isHotelStayPriceNight,
} from "./quote-costing";

describe("component selling-price display helpers", () => {
  it("uses hotel sellingPrice as stay total and does not invent values", () => {
    expect(displayComponentSellingPrice({ sellingPrice: 30000 }, "hotel")).toBe(30000);
    expect(displayComponentSellingPrice({ sellingPrice: 0 }, "hotel")).toBeNull();
    expect(displayComponentSellingPrice({ sellingPrice: null }, "hotel")).toBeNull();
    expect(displayComponentSellingPrice(undefined, "hotel")).toBeNull();
    expect(displayComponentSellingPrice({ complimentary: true, sellingPrice: 5000 }, "hotel")).toBeNull();
  });

  it("shows hotel stay price only on check-in night (no multi-night multiply)", () => {
    const hotel = {
      lineId: "h1",
      checkIn: "2026-10-10",
      checkOut: "2026-10-13",
      nights: 3,
      sellingPrice: 30000,
    };
    expect(isHotelStayPriceNight(hotel, "2026-10-10")).toBe(true);
    expect(isHotelStayPriceNight(hotel, "2026-10-11")).toBe(false);
    expect(isHotelStayPriceNight(hotel, "2026-10-12")).toBe(false);

    const nights = ["2026-10-10", "2026-10-11", "2026-10-12"];
    const displayed = nights
      .filter((d) => isHotelStayPriceNight(hotel, d))
      .map(() => displayComponentSellingPrice(hotel, "hotel"));
    expect(displayed).toEqual([30000]);
    expect(displayed.reduce((s, n) => s + (n || 0), 0)).toBe(30000);
  });

  it("resolves flight sellingPrice or fare", () => {
    expect(displayComponentSellingPrice({ sellingPrice: 12000 }, "flight")).toBe(12000);
    expect(displayComponentSellingPrice({ fare: 9500 }, "flight")).toBe(9500);
    expect(displayComponentSellingPrice({ sellingPrice: 0, fare: 0 }, "flight")).toBeNull();
  });

  it("maps itinerary line ids to package rows for transfer/activity/meal", () => {
    const transfers = [{ lineId: "t1", sellingPrice: 2500, name: "Airport" }];
    const activities = [{ lineId: "a1", sellingPrice: 8000, name: "City Tour" }];
    const meals = [{ lineId: "m1", sellingPrice: 1200, name: "Lunch" }];

    expect(displayComponentSellingPrice(findPackageLineById(transfers, "t1", "transfer"), "transfer")).toBe(2500);
    expect(displayComponentSellingPrice(findPackageLineById(transfers, "transfer:t1", "transfer"), "transfer")).toBe(2500);
    expect(displayComponentSellingPrice(findPackageLineById(activities, "a1", "activity"), "activity")).toBe(8000);
    expect(displayComponentSellingPrice(findPackageLineById(meals, "m1", "meal"), "meal")).toBe(1200);
    expect(findPackageLineById(transfers, "missing", "transfer")).toBeNull();
  });

  it("prefers activity sellingPrice over adultRate for card display", () => {
    const withSell = {
      sellingPrice: 8000,
      adultRate: 3000,
      childRate: 1500,
      adults: 2,
      children: 1,
    };
    expect(displayComponentSellingPrice(withSell, "activity")).toBe(8000);

    const ratesOnly = {
      adultRate: 3000,
      childRate: 1500,
      adults: 2,
      children: 1,
    };
    expect(displayComponentSellingPrice(ratesOnly, "activity")).toBe(7500);
  });

  it("does not re-multiply quantity on display (sellingPrice is line total)", () => {
    expect(displayComponentSellingPrice({ sellingPrice: 2000, quantity: 3 }, "transfer")).toBe(2000);
    expect(displayComponentSellingPrice({ sellingPrice: 500, quantity: 2 }, "addon")).toBe(500);
  });

  it("day-card display helpers do not alter calcPackageCosting totals", () => {
    const pkg = {
      hotels: [{ sellingPrice: 30000, costPrice: 20000, checkIn: "2026-10-10", checkOut: "2026-10-13" }],
      flights: [{ sellingPrice: 12000, fare: 12000 }],
      transfers: [{ lineId: "t1", sellingPrice: 2500 }],
      activities: [{ lineId: "a1", sellingPrice: 8000 }],
      meals: [{ lineId: "m1", sellingPrice: 1200 }],
      addOns: [{ lineId: "ao1", sellingPrice: 400, enabled: true }],
      trevioMarkupValue: 0,
      adults: 2,
      children: 0,
    };
    const before = calcPackageCosting(pkg);
    // Simulate display resolution (side-effect free)
    void displayComponentSellingPrice(pkg.hotels[0], "hotel");
    void displayComponentSellingPrice(pkg.transfers[0], "transfer");
    void displayComponentSellingPrice(pkg.activities[0], "activity");
    void displayComponentSellingPrice(pkg.meals[0], "meal");
    void displayComponentSellingPrice(pkg.addOns[0], "addon");
    const after = calcPackageCosting(pkg);
    expect(after.total).toBe(before.total);
    expect(after.services.map((s) => s.sellingPrice)).toEqual(before.services.map((s) => s.sellingPrice));
  });

  it("display-only day total sums shown components without hotel multi-night double count", () => {
    const hotel = { lineId: "h1", checkIn: "2026-10-10", checkOut: "2026-10-13", sellingPrice: 30000 };
    const transfers = [{ lineId: "t1", sellingPrice: 2500 }];
    const activities = [{ lineId: "a1", sellingPrice: 8000 }];
    const meals = [{ lineId: "m1", sellingPrice: 1200 }];
    const dayItems = [
      { itemType: "TRANSFER", transferLineId: "t1" },
      { itemType: "ACTIVITY", activityLineId: "a1" },
      { itemType: "MEAL", mealLineId: "m1" },
    ];

    function dayTotal(nightDate: string) {
      let sum = 0;
      if (isHotelStayPriceNight(hotel, nightDate)) {
        const s = displayComponentSellingPrice(hotel, "hotel");
        if (s != null) sum += s;
      }
      for (const item of dayItems) {
        const t = String(item.itemType);
        if (t === "TRANSFER") {
          const s = displayComponentSellingPrice(findPackageLineById(transfers, item.transferLineId!, "transfer"), "transfer");
          if (s != null) sum += s;
        } else if (t === "ACTIVITY") {
          const s = displayComponentSellingPrice(findPackageLineById(activities, item.activityLineId!, "activity"), "activity");
          if (s != null) sum += s;
        } else if (t === "MEAL") {
          const s = displayComponentSellingPrice(findPackageLineById(meals, item.mealLineId!, "meal"), "meal");
          if (s != null) sum += s;
        }
      }
      return sum;
    }

    expect(dayTotal("2026-10-10")).toBe(30000 + 2500 + 8000 + 1200);
    expect(dayTotal("2026-10-11")).toBe(2500 + 8000 + 1200);
  });
});
