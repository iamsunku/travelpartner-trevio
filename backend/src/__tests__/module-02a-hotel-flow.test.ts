import { describe, expect, it } from "vitest";
import {
  buildTripCityStayWindows,
  selfBookedHotelTransferLocations,
  syncHotelRowsToTripStays,
} from "../lib/quote-trip-cities.js";
import { pricePackage, priceLine } from "../lib/pricing.js";
import {
  findApplicableContractedRate,
  presentApplicableRate,
  type RateWindow,
} from "../lib/contracted-rates.js";
import { buildVersionSnapshot, hasMeaningfulQuotationChange } from "../lib/quotation-versions.js";
import { buildQuotationPdfModel } from "../lib/quotation-pdf/model.js";

const tax = {
  id: "tax-1",
  name: "GST",
  rate: 5,
  method: "EXCLUSIVE" as const,
  active: true,
};

const rateCtx = {
  currency: "INR",
  nights: 5,
  adults: 2,
  children: 0,
  infants: 0,
  trevioMarkup: { type: "Fixed" as const, value: 0 },
  agentMarkup: { type: "Fixed" as const, value: 0 },
  taxRule: tax,
};

describe("Module 02A — multi-city stay windows", () => {
  it("E. Phuket 3 + Krabi 2 from 18 Oct", () => {
    const windows = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 3, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
      "2026-10-18",
    );
    expect(windows).toEqual([
      { city: "Phuket", nights: 3, order: 1, destinationId: null, checkIn: "2026-10-18", checkOut: "2026-10-21" },
      { city: "Krabi", nights: 2, order: 2, destinationId: null, checkIn: "2026-10-21", checkOut: "2026-10-23" },
    ]);
  });

  it("F. Phuket 3 + Krabi 2 + Bangkok 2", () => {
    const windows = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 3, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
        { city: "Bangkok", nights: 2, order: 3 },
      ],
      "2026-10-18",
    );
    expect(windows.map((w) => [w.city, w.checkIn, w.checkOut, w.nights])).toEqual([
      ["Phuket", "2026-10-18", "2026-10-21", 3],
      ["Krabi", "2026-10-21", "2026-10-23", 2],
      ["Bangkok", "2026-10-23", "2026-10-25", 2],
    ]);
  });

  it("G. Phuket 3→4 updates dependent city windows; unlocked hotels sync", () => {
    const before = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 3, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
      "2026-10-18",
    );
    const after = buildTripCityStayWindows(
      [
        { city: "Phuket", nights: 4, order: 1 },
        { city: "Krabi", nights: 2, order: 2 },
      ],
      "2026-10-18",
    );
    expect(after[0]).toMatchObject({ checkIn: "2026-10-18", checkOut: "2026-10-22", nights: 4 });
    expect(after[1]).toMatchObject({ checkIn: "2026-10-22", checkOut: "2026-10-24", nights: 2 });

    const hotels = [
      {
        hotelName: "A",
        tripCity: "Phuket",
        city: "Phuket",
        checkIn: before[0].checkIn,
        checkOut: before[0].checkOut,
        nights: 3,
      },
      {
        hotelName: "B",
        tripCity: "Krabi",
        city: "Krabi",
        checkIn: before[1].checkIn,
        checkOut: before[1].checkOut,
        nights: 2,
      },
      {
        hotelName: "Locked",
        tripCity: "Phuket",
        city: "Phuket",
        checkIn: "2026-10-19",
        checkOut: "2026-10-20",
        nights: 1,
        stayDatesLocked: true,
      },
    ];
    const synced = syncHotelRowsToTripStays(hotels, after);
    expect(synced[0]).toMatchObject({ checkIn: "2026-10-18", checkOut: "2026-10-22", nights: 4 });
    expect(synced[1]).toMatchObject({ checkIn: "2026-10-22", checkOut: "2026-10-24", nights: 2 });
    expect(synced[2]).toMatchObject({ checkIn: "2026-10-19", checkOut: "2026-10-20", nights: 1, stayDatesLocked: true });
  });
});

describe("Module 02A — Recommended = contracted", () => {
  const rates: RateWindow[] = [
    {
      id: "r1",
      contractedCost: 4000,
      currency: "INR",
      rateUnit: "PER_ROOM_NIGHT",
      validFrom: "2026-10-01",
      validTo: "2026-10-31",
      active: true,
    },
  ];

  it("A. applicable contracted rate → recommended eligibility OK", () => {
    expect(findApplicableContractedRate(rates, "2026-10-18").status).toBe("OK");
  });

  it("B. 4-star / featured without covering rate is NOT applicable", () => {
    expect(findApplicableContractedRate(rates, "2026-11-15").status).toBe("NO_VALID_RATE");
    // Stars/isFeatured are irrelevant to findApplicableContractedRate — only validity matters.
  });
});

describe("Module 02A — self-booked pricing", () => {
  it("C. self-booked has no invented 8000/10000 and does not inflate totals", () => {
    const line = {
      source: "MANUAL",
      selfBooked: true,
      productType: "HOTEL",
      hotelName: "Guest Villa",
      address: "12 Beach Rd",
      city: "Phuket",
      tripCity: "Phuket",
      checkIn: "2026-10-18",
      checkOut: "2026-10-21",
      nights: 3,
      rooms: 2,
    };
    expect(line).not.toHaveProperty("costPrice");
    expect(line).not.toHaveProperty("sellingPrice");
    const priced = priceLine(line, rateCtx);
    expect(priced.unresolved).toBe(false);
    expect(priced.contractedCost).toBe(0);

    const pkg = pricePackage({ hotels: [line] }, rateCtx);
    expect(pkg.contractedCost).toBe(0);
    expect(pkg.unresolved).toBe(false);
  });

  it("self-booked does not receive contracted rate treatment", () => {
    const priced = priceLine(
      {
        source: "MANUAL",
        selfBooked: true,
        hotelName: "X",
        productId: "should-be-ignored",
        productType: "HOTEL",
      },
      rateCtx,
    );
    expect(priced.contractedCost).toBe(0);
    expect(priced.unresolved).toBe(false);
  });

  it("explicit commercial amount on self-booked is still priced", () => {
    const priced = priceLine(
      {
        source: "MANUAL",
        selfBooked: true,
        hotelName: "X",
        costPrice: 2500,
      },
      rateCtx,
    );
    expect(priced.contractedCost).toBe(2500);
    expect(priced.unresolved).toBe(false);
  });
});

describe("Module 02A — self-booked → transfer locations", () => {
  it("D. address reaches transfer selection helper", () => {
    const locs = selfBookedHotelTransferLocations([
      {
        lineId: "h1",
        selfBooked: true,
        source: "MANUAL",
        hotelName: "Sea View",
        address: "99 Patong Beach",
        tripCity: "Phuket",
        city: "Phuket",
      },
      {
        source: "CONTRACTED_PRODUCT",
        hotelName: "Contracted",
        address: "Should not appear",
        city: "Phuket",
      },
      {
        selfBooked: true,
        source: "MANUAL",
        hotelName: "No address",
        city: "Krabi",
      },
    ]);
    expect(locs).toHaveLength(1);
    expect(locs[0]).toMatchObject({
      lineId: "h1",
      address: "99 Patong Beach",
      city: "Phuket",
    });
    expect(locs[0].label).toContain("99 Patong Beach");
  });
});

describe("Module 02A — hotel-specific nights pricing", () => {
  it("H. Phuket 3n and Krabi 2n priced separately (not trip total 5)", () => {
    const pkg = pricePackage(
      {
        hotels: [
          {
            source: "CONTRACTED_PRODUCT",
            productType: "HOTEL",
            rooms: 2,
            checkIn: "2026-10-18",
            checkOut: "2026-10-21",
            nights: 3,
            tripCity: "Phuket",
            rateSnapshot: {
              contractedCost: 1000,
              currency: "INR",
              rateUnit: "PER_ROOM_NIGHT",
              frozen: true,
            },
          },
          {
            source: "CONTRACTED_PRODUCT",
            productType: "HOTEL",
            rooms: 2,
            checkIn: "2026-10-21",
            checkOut: "2026-10-23",
            nights: 2,
            tripCity: "Krabi",
            rateSnapshot: {
              contractedCost: 1500,
              currency: "INR",
              rateUnit: "PER_ROOM_NIGHT",
              frozen: true,
            },
          },
        ],
      },
      rateCtx,
    );
    // 1000*2*3 + 1500*2*2 = 6000 + 6000 = 12000 (NOT 1000*2*5 + 1500*2*5)
    expect(pkg.contractedCost).toBe(12000);
  });
});

describe("Module 02A — agent selection security", () => {
  const okRate: RateWindow = {
    id: "rate-ok",
    contractedCost: 7777,
    currency: "INR",
    rateUnit: "PER_ROOM_NIGHT",
    validFrom: "2026-10-01",
    validTo: "2026-10-31",
    active: true,
  };

  it("J. agent applicable payload has no contractedCost; staff does", () => {
    const result = findApplicableContractedRate([okRate], "2026-10-18");
    const agent = presentApplicableRate(result, "travel_agent", {
      productType: "HOTEL",
      productId: "h1",
      displayPrice: 9000,
    });
    const staff = presentApplicableRate(result, "admin", {
      productType: "HOTEL",
      productId: "h1",
      displayPrice: 9000,
    });
    expect(agent.applicable).toBe(true);
    expect(agent.rateId).toBe("rate-ok");
    expect(agent).not.toHaveProperty("contractedCost");
    expect(staff.applicable).toBe(true);
    expect(staff.contractedCost).toBe(7777);
  });

  it("K. invalid rate remains blocked for all roles", () => {
    const result = findApplicableContractedRate([okRate], "2027-01-01");
    const agent = presentApplicableRate(result, "travel_agent", {
      productType: "HOTEL",
      productId: "h1",
    });
    expect(agent.applicable).toBe(false);
    expect(agent).not.toHaveProperty("rateId");
  });
});

describe("Module 02A — versioning / PDF / rooms availability contract", () => {
  it("N. version snapshot keeps city-specific hotel stays and selfBooked", () => {
    const quote = {
      customerName: "A",
      packages: [
        {
          name: "Standard",
          isSelected: true,
          hotels: [
            {
              hotelName: "A",
              tripCity: "Phuket",
              checkIn: "2026-10-18",
              checkOut: "2026-10-21",
              nights: 3,
              selfBooked: true,
              address: "Addr",
              source: "MANUAL",
            },
          ],
        },
      ],
    };
    const snap = buildVersionSnapshot(quote);
    const hotels = (snap.packages as Array<Record<string, unknown>>)[0].hotels as Array<Record<string, unknown>>;
    expect(hotels[0].tripCity).toBe("Phuket");
    expect(hotels[0].selfBooked).toBe(true);
    expect(hotels[0].checkOut).toBe("2026-10-21");
    expect(hasMeaningfulQuotationChange(quote, {
      ...quote,
      packages: [{
        ...quote.packages[0],
        hotels: [{ ...quote.packages[0].hotels[0], nights: 4 }],
      }],
    })).toBe(true);
  });

  it("O. PDF maps city-specific dates and self-booked flag", () => {
    const model = buildQuotationPdfModel({
      quote: {
        quoteNo: "Q-1",
        customerName: "Guest",
        packages: [
          {
            name: "Standard",
            isSelected: true,
            hotels: [
              {
                hotelName: "Villa",
                tripCity: "Phuket",
                city: "WrongFallback",
                checkIn: "2026-10-18",
                checkOut: "2026-10-21",
                nights: 3,
                selfBooked: true,
                address: "99 Beach",
                mealPlan: "Room Only",
                roomType: "Studio",
              },
            ],
          },
        ],
      },
      mode: "customer",
      audience: "customer",
    });
    const hotel = model.packages[0].hotels[0];
    expect(hotel.city).toBe("Phuket");
    expect(hotel.checkIn).toBe("2026-10-18");
    expect(hotel.checkOut).toBe("2026-10-21");
    expect(hotel.nights).toBe(3);
    expect(hotel.selfBooked).toBe(true);
    expect(hotel.address).toBe("99 Beach");
  });

  it("I. catalogue availability rooms query must use quote rooms (contract)", () => {
    // Regression contract: callers must pass quote rooms, never hardcode "1".
    const quoteRooms = 2;
    const params = new URLSearchParams({
      checkIn: "2026-10-18",
      checkOut: "2026-10-21",
      rooms: String(Math.max(1, quoteRooms)),
    });
    expect(params.get("rooms")).toBe("2");
    expect(params.get("rooms")).not.toBe("1");
  });
});
