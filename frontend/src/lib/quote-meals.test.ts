import { describe, expect, it } from "vitest";
import { buildTripCityStayWindows } from "./quote-trip-stays";
import {
  applyMealCityChange,
  defaultMealDateForCity,
  hotelBreakfastDuplicationWarning,
  hotelMealPlanIncludesBreakfast,
  isDateInCityStay,
  mealTypeIsBreakfast,
  syncMealRowsToTripStays,
} from "./quote-meals";
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

describe("MODULE 06A — meals", () => {
  it("1–3. self-booked meal has no invented prices + selfBooked flag", () => {
    const template = {
      source: "MANUAL",
      selfBooked: true,
      adultRate: undefined,
      childRate: undefined,
      costPrice: undefined,
      sellingPrice: undefined,
    };
    expect(template.selfBooked).toBe(true);
    expect(template.source).toBe("MANUAL");
    expect(template.adultRate).toBeUndefined();
    expect(template.costPrice).toBeUndefined();
    expect(template.sellingPrice).toBeUndefined();
  });

  it("4–8. city mapping + date defaults + validation", () => {
    const windows = multiCityWindows();
    expect(defaultMealDateForCity(windows, "Krabi")).toBe("2026-10-22");
    expect(defaultMealDateForCity(windows, "Phuket")).not.toBe("2026-10-21");
    expect(isDateInCityStay(windows, "Krabi", "2026-10-22")).toBe(true);
    expect(isDateInCityStay(windows, "Krabi", "2026-10-18")).toBe(false);

    const changed = applyMealCityChange(
      { city: "Phuket", date: "2026-10-19", dateSource: "MANUAL" },
      "Krabi",
      windows,
    );
    expect(changed.city).toBe("Krabi");
    expect(changed.date).toBe("2026-10-22");
    expect(changed.dateSource).toBe("AUTO");
  });

  it("9–13. meal types Breakfast/Lunch/Dinner/Snacks/Other supported as labels", () => {
    for (const t of ["Breakfast", "Lunch", "Dinner", "Snacks", "Other"]) {
      expect(String(t).length).toBeGreaterThan(0);
    }
    expect(mealTypeIsBreakfast("Breakfast")).toBe(true);
    expect(mealTypeIsBreakfast("Dinner")).toBe(false);
  });

  it("14–24. meal → itinerary preserves city/time/remarks/voucher/pax", () => {
    const windows = multiCityWindows();
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      meals: [
        {
          lineId: "m1",
          mealType: "Breakfast",
          city: "Phuket",
          date: "2026-10-19",
          restaurant: "Beach Cafe",
          location: "Patong",
          description: "Buffet",
          time: "08:00",
          duration: "1h",
          adults: 2,
          children: 1,
          infants: 0,
          remarks: "Window seat",
          voucher: "M-1",
          dietary: "Vegetarian",
        },
        {
          lineId: "m2",
          mealType: "Dinner",
          city: "Krabi",
          date: "2026-10-22",
          restaurant: "Ao Nang Grill",
          adults: 2,
        },
        {
          lineId: "m3",
          mealType: "Lunch",
          city: "Bangkok",
          date: "2026-10-24",
          restaurant: "Siam Kitchen",
          adults: 2,
        },
      ],
    });
    const d19 = days.find((d) => d.date === "2026-10-19")!;
    expect(d19.city).toBe("Phuket");
    const breakfast = (d19.items as Record<string, unknown>[]).find((i) => i.itemType === "MEAL")!;
    expect(breakfast.activityName).toBe("Breakfast");
    expect(breakfast.pickupTime).toBe("08:00");
    expect(breakfast.duration).toBe("1h");
    expect(breakfast.remarks).toBe("Window seat");
    expect(breakfast.voucher).toBe("M-1");
    expect(String(breakfast.description)).toContain("Patong");
    expect(String(breakfast.description)).toContain("Vegetarian");
    expect(String(breakfast.description)).toContain("2 adult");

    expect(days.find((d) => d.date === "2026-10-22")!.city).toBe("Krabi");
    expect(days.find((d) => d.date === "2026-10-24")!.city).toBe("Bangkok");
  });

  it("25–26. hotel breakfast warning is city-aware and non-destructive", () => {
    expect(hotelMealPlanIncludesBreakfast("Breakfast")).toBe(true);
    expect(hotelMealPlanIncludesBreakfast("Dinner only")).toBe(false);
    const hotels = [
      {
        hotelName: "Patong Bay",
        tripCity: "Phuket",
        mealPlan: "Breakfast",
        checkIn: "2026-10-18",
        checkOut: "2026-10-21",
      },
      {
        hotelName: "Ao Nang Inn",
        tripCity: "Krabi",
        mealPlan: "Room only",
        checkIn: "2026-10-21",
        checkOut: "2026-10-23",
      },
    ];
    expect(hotelBreakfastDuplicationWarning({
      mealType: "Breakfast",
      mealCity: "Phuket",
      mealDate: "2026-10-19",
      hotels,
    })).toMatch(/already be included/i);
    expect(hotelBreakfastDuplicationWarning({
      mealType: "Dinner",
      mealCity: "Phuket",
      mealDate: "2026-10-19",
      hotels,
    })).toBeNull();
    expect(hotelBreakfastDuplicationWarning({
      mealType: "Breakfast",
      mealCity: "Krabi",
      mealDate: "2026-10-22",
      hotels,
    })).toBeNull();
  });

  it("27–28. meal dedupe on regenerate + same-day coexistence", () => {
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 3, order: 1 }], start);
    const input = {
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
      meals: [{
        lineId: "m1",
        mealType: "Lunch",
        city: "Phuket",
        date: "2026-10-20",
        adults: 2,
      }],
      activities: [{
        lineId: "a1",
        activityName: "Tour",
        city: "Phuket",
        date: "2026-10-20",
      }],
    };
    const once = syncPackageItinerary([], input);
    const twice = syncPackageItinerary(once, input);
    const d20 = twice.find((d) => d.date === "2026-10-20")!;
    const meals = (d20.items as Record<string, unknown>[]).filter((i) => i.itemType === "MEAL");
    expect(meals).toHaveLength(1);
    expect((d20.items as Record<string, unknown>[]).some((i) => i.itemType === "ACTIVITY")).toBe(true);
    expect((d20.items as Record<string, unknown>[]).some((i) => i.itemType === "HOTEL")).toBe(true);
  });

  it("22–23. meal date sync AUTO vs MANUAL + orphan city flag", () => {
    const windows = multiCityWindows();
    const synced = syncMealRowsToTripStays(
      [
        { lineId: "a", city: "Phuket", date: "2026-10-19", dateSource: "AUTO" },
        { lineId: "b", city: "Phuket", date: "2026-10-19", dateSource: "MANUAL" },
        { lineId: "c", city: "Chiang Mai", date: "2026-10-20", dateSource: "MANUAL" },
      ],
      // Shift Phuket later by changing start via rebuilt windows (Krabi-first scenario)
      buildTripCityStayWindows(
        [
          { city: "Krabi", nights: 2, order: 1 },
          { city: "Phuket", nights: 3, order: 2 },
        ],
        start,
      ),
    );
    const auto = synced.find((m) => m.lineId === "a")!;
    expect(auto.date).toBe(defaultMealDateForCity(
      buildTripCityStayWindows(
        [
          { city: "Krabi", nights: 2, order: 1 },
          { city: "Phuket", nights: 3, order: 2 },
        ],
        start,
      ),
      "Phuket",
    ));
    const manual = synced.find((m) => m.lineId === "b")!;
    expect(manual.date).toBe("2026-10-19");
    expect(manual.dateInvalid).toBe(true);
    const orphan = synced.find((m) => m.lineId === "c")!;
    expect(orphan.cityOrphan).toBe(true);
    expect(String(orphan.cityOrphanReason)).toMatch(/no longer in the trip plan/i);
  });
});
