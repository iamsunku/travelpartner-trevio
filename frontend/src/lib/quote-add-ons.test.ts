import { describe, expect, it } from "vitest";
import { calcPackageCosting } from "./quote-costing";
import { syncPackageItinerary } from "./quote-itinerary-sync";
import { buildTripCityStayWindows } from "./quote-trip-stays";

describe("quotation Add-ons restructuring", () => {
  const start = "2026-10-18";

  it("stores and prices addOns from packages[].addOns without itinerary MISC", () => {
    const addOns = [
      {
        lineId: "ao1",
        name: "Local SIM",
        description: "7-day data",
        date: "2026-10-19",
        city: "Phuket",
        quantity: 2,
        costPrice: 400,
        sellingPrice: 800,
        enabled: true,
        source: "CATALOG",
      },
      {
        lineId: "ao2",
        name: "Porterage",
        sellingPrice: 300,
        costPrice: 200,
        enabled: true,
        source: "PRESET",
      },
    ];

    const costing = calcPackageCosting({
      hotels: [],
      flights: [],
      transfers: [],
      activities: [],
      meals: [],
      addOns,
      trevioMarkupValue: 0,
      adults: 2,
      children: 0,
    });

    const addOnRow = costing.services.find((s) => s.key === "addOns");
    expect(addOnRow?.label).toBe("Add-ons");
    // lineTotals multiplies sellingPrice × quantity (800×2 + 300)
    expect(addOnRow?.sellingPrice).toBe(1900);
    expect(addOnRow?.netCost).toBe(1000);
    expect(costing.total).toBeGreaterThanOrEqual(1900);

    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 2, order: 1 }], start);
    const days = syncPackageItinerary([], {
      stayWindows: windows,
      travelStartDate: start,
      addOns,
    });
    const items = days.flatMap((d) => (d.items as Record<string, unknown>[]) || []);
    expect(items.some((i) => i.autoFromMisc)).toBe(false);
    expect(items.some((i) => String(i.activityName).includes("SIM"))).toBe(false);
  });

  it("editing/deleting addOns updates canonical rows and clears legacy auto MISC", () => {
    let addOns: Record<string, unknown>[] = [
      { lineId: "ao1", name: "SIM", sellingPrice: 500, costPrice: 300, date: "2026-10-18", enabled: true },
    ];
    const windows = buildTripCityStayWindows([{ city: "Phuket", nights: 1, order: 1 }], start);
    let itinerary: Record<string, unknown>[] = [{
      day: 1,
      date: "2026-10-18",
      city: "Phuket",
      items: [
        {
          itemType: "MISC",
          activityName: "SIM",
          autoFromMisc: true,
          miscLineId: "ao1",
          sourceKey: "misc:ao1",
        },
      ],
    }];

    addOns = addOns.map((a) => (a.lineId === "ao1" ? { ...a, name: "SIM Plus", sellingPrice: 700 } : a));
    itinerary = syncPackageItinerary(itinerary, { stayWindows: windows, travelStartDate: start, addOns });
    expect(addOns[0].name).toBe("SIM Plus");
    expect(addOns[0].sellingPrice).toBe(700);
    expect(((itinerary[0].items as Record<string, unknown>[]) || []).some((i) => i.autoFromMisc)).toBe(false);

    addOns = [];
    itinerary = syncPackageItinerary(itinerary, { stayWindows: windows, travelStartDate: start, addOns });
    const leftover = ((itinerary[0]?.items as Record<string, unknown>[]) || [])
      .filter((i) => i.autoFromMisc === true || String(i.miscLineId) === "ao1");
    expect(leftover).toHaveLength(0);

    const costing = calcPackageCosting({
      addOns,
      trevioMarkupValue: 0,
      adults: 2,
      children: 0,
    });
    expect(costing.services.find((s) => s.key === "addOns")?.sellingPrice).toBe(0);
  });

  it("disabled addOns are excluded from selling totals", () => {
    const costing = calcPackageCosting({
      addOns: [
        { name: "On", sellingPrice: 100, enabled: true },
        { name: "Off", sellingPrice: 999, enabled: false },
      ],
      trevioMarkupValue: 0,
      adults: 1,
      children: 0,
    });
    expect(costing.services.find((s) => s.key === "addOns")?.sellingPrice).toBe(100);
  });
});
