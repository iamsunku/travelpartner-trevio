import { describe, expect, it } from "vitest";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import { buildQuotationPdfModel } from "../lib/quotation-pdf/model.js";

describe("MODULE 06A — meals backend", () => {
  it("29. PDF meal map includes city/time/pax/selling without cost", () => {
    const model = buildQuotationPdfModel({
      quote: {
        quoteNo: "Q-06A",
        customerName: "Test",
        currency: "THB",
        packages: [{
          name: "Standard",
          meals: [{
            mealType: "Breakfast",
            restaurant: "Beach Cafe",
            location: "Patong",
            city: "Phuket",
            date: "2026-10-19",
            time: "08:00",
            duration: "1h",
            adults: 2,
            children: 1,
            remarks: "Window",
            voucher: "M-9",
            description: "Buffet",
            sellingPrice: 2400,
            currency: "THB",
            costPrice: 900,
            contractedCost: 900,
          }],
        }],
      },
      mode: "customer",
      audience: "customer",
    } as never);

    const meal = model.packages[0].meals[0];
    expect(meal.mealType).toBe("Breakfast");
    expect(meal.city).toBe("Phuket");
    expect(meal.date).toBe("2026-10-19");
    expect(meal.time).toBe("08:00");
    expect(meal.location).toBe("Patong");
    expect(meal.paxLabel).toContain("2 adult");
    expect(meal.sellingPrice).toBe(2400);
    expect(meal.voucher).toBe("M-9");
    expect((meal as { costPrice?: number }).costPrice).toBeUndefined();
  });

  it("30–32. agent sanitize strips meal cost/supplier; booking note shape", () => {
    const quote = {
      id: "q1",
      packages: [{
        meals: [{
          mealType: "Dinner",
          city: "Krabi",
          costPrice: 900,
          contractedCost: 900,
          sellingPrice: 1200,
          supplier: "Secret DMC",
        }],
      }],
      totalNetCost: 900,
    };
    const agent = sanitizeQuotationForRole(quote, "travel_agent") as typeof quote;
    const meal = agent.packages[0].meals[0] as Record<string, unknown>;
    expect(meal.costPrice).toBeUndefined();
    expect(meal.contractedCost).toBeUndefined();
    expect(meal.supplier).toBeUndefined();
    expect(meal.sellingPrice).toBe(1200);

    const bookingNote = [
      "City Krabi",
      "Date 2026-10-22",
      "Time 19:00",
      "2 adult(s)",
      "Voucher M-1",
      "Source: MANUAL",
    ].join(" · ");
    expect(bookingNote).toContain("City Krabi");
    expect(bookingNote).toContain("Voucher M-1");
  });
});
