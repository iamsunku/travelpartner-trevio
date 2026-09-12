import { describe, expect, it } from "vitest";
import { sanitizeQuotationForRole } from "../lib/quotations.js";
import {
  CURRENCY_CONVERSION_UNAVAILABLE,
  TAX_CONFIGURATION_REQUIRED,
  percentOf,
  pricePackage,
  stripAgentPricingOverrides,
  type TaxRuleInput,
} from "../lib/pricing.js";

const tax: TaxRuleInput = {
  id: "tax-1",
  name: "Configured GST",
  rate: 10,
  method: "EXCLUSIVE",
  active: true,
};

const ctx = {
  currency: "INR",
  nights: 4,
  adults: 2,
  children: 1,
  infants: 1,
  trevioMarkup: { type: "Percentage" as const, value: 15 },
  agentMarkup: { type: "Percentage" as const, value: 10 },
  taxRule: tax,
};

function hotel(cost = 5000) {
  return {
    source: "CONTRACTED_PRODUCT",
    productType: "HOTEL",
    productId: "h1",
    rooms: 3,
    rateSnapshot: { contractedCost: cost, currency: "INR", rateUnit: "PER_ROOM_NIGHT", frozen: true },
  };
}

describe("phase 3 pricing", () => {
  it("A-B. hotel rooms and nights multiply a room-night rate", () => {
    const priced = pricePackage({ hotels: [hotel()] }, { ...ctx, trevioMarkup: { type: "Percentage", value: 0 }, agentMarkup: { type: "Fixed", value: 0 }, children: 0, infants: 0 });
    expect(priced.contractedCost).toBe(5000 * 3 * 4);
  });

  it("C-E. adult, child, and infant quantities use only configured rates", () => {
    const priced = pricePackage({
      activities: [{
        source: "CONTRACTED_PRODUCT",
        productType: "ACTIVITY",
        rateSnapshot: { contractedCost: 1000, currency: "INR", rateUnit: "PER_PASSENGER", metadata: { childCost: 400, infantCost: 100 }, frozen: true },
      }],
    }, { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(priced.contractedCost).toBe(1000 * 2 + 400 * 1 + 100 * 1);
    const noInfantRate = pricePackage({
      activities: [{
        source: "CONTRACTED_PRODUCT",
        productType: "ACTIVITY",
        rateSnapshot: { contractedCost: 1000, currency: "INR", rateUnit: "PER_PASSENGER", frozen: true },
      }],
    }, { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(noInfantRate.contractedCost).toBe(2000);
  });

  it("F. activity passenger pricing stays on the product snapshot", () => {
    const priced = pricePackage({
      activities: [{
        source: "CONTRACTED_PRODUCT",
        productId: "act-1",
        productType: "ACTIVITY",
        rateSnapshot: { contractedCost: 800, rateId: "r1", currency: "INR", rateUnit: "PER_PASSENGER", metadata: { childCost: 300 }, frozen: true },
      }],
    }, { ...ctx, adults: 2, children: 2, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(priced.contractedCost).toBe(800 * 2 + 300 * 2);
  });

  it("G. a vehicle transfer is not multiplied by every passenger", () => {
    const priced = pricePackage({
      transfers: [{
        source: "CONTRACTED_PRODUCT",
        productType: "TRANSFER",
        rateSnapshot: { contractedCost: 2000, currency: "INR", rateUnit: "PER_VEHICLE", frozen: true },
      }],
    }, { ...ctx, adults: 4, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(priced.contractedCost).toBe(2000);
    const byCapacity = pricePackage({
      transfers: [{
        source: "CONTRACTED_PRODUCT",
        productType: "TRANSFER",
        capacity: 2,
        rateSnapshot: { contractedCost: 2000, currency: "INR", rateUnit: "PER_VEHICLE", frozen: true },
      }],
    }, { ...ctx, adults: 4, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(byCapacity.contractedCost).toBe(4000);
  });

  it("H. meal quantity uses passenger rates and does not recount an included meal", () => {
    const selected = pricePackage({
      meals: [{
        source: "CONTRACTED_PRODUCT",
        productType: "MEAL",
        quantity: 2,
        rateSnapshot: { contractedCost: 500, currency: "INR", rateUnit: "PER_PASSENGER", metadata: { childCost: 250 }, frozen: true },
      }],
    }, { ...ctx, adults: 2, children: 1, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(selected.contractedCost).toBe((500 * 2 + 250) * 2);
    const included = pricePackage({
      meals: [{ includedInPlan: true, source: "CONTRACTED_PRODUCT", rateSnapshot: { contractedCost: 500, currency: "INR" } }],
    }, { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(included.contractedCost).toBe(0);
  });

  it("I-J. contracted flights use the snapshot; API and manual flights use explicit amounts", () => {
    const contracted = pricePackage({
      flights: [{
        source: "CONTRACTED_PRODUCT",
        productType: "FLIGHT",
        rateSnapshot: { contractedCost: 4000, currency: "INR", rateUnit: "PER_PASSENGER", frozen: true },
      }],
    }, { ...ctx, adults: 2, children: 0, infants: 1, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(contracted.contractedCost).toBe(8000);
    const api = pricePackage({ flights: [{ source: "AMADEUS_API", fare: 15000, airline: "TG" }] }, { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(api.contractedCost).toBe(15000);
    const manual = pricePackage({ flights: [{ source: "MANUAL", costPrice: 9000, airline: "6E" }] }, { ...ctx, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(manual.contractedCost).toBe(9000);
  });

  it("K-L. 15% Trevio markup then 10% agent markup", () => {
    const priced = pricePackage({
      hotels: [{ source: "CONTRACTED_PRODUCT", productType: "HOTEL", rooms: 1, nights: 1, rateSnapshot: { contractedCost: 10000, currency: "INR", rateUnit: "PER_ROOM_NIGHT", frozen: true } }],
    }, { ...ctx, nights: 1, adults: 1, children: 0, infants: 0, trevioMarkup: { type: "Percentage", value: 15 }, agentMarkup: { type: "Percentage", value: 10 } });
    expect(priced.contractedCost).toBe(10000);
    expect(priced.trevioSellingPrice).toBe(11500);
    expect(priced.customerPrice).toBe(12650);
  });

  it("M-R. agents cannot set protected prices and customers cannot see internal layers", () => {
    const stripped = stripAgentPricingOverrides({
      contractedCost: 1,
      trevioMarkup: 0,
      trevioSellingPrice: 1,
      agentMarkup: 10,
    });
    expect(stripped).toEqual({ agentMarkup: 10 });
    const quote = sanitizeQuotationForRole({
      total: 12650,
      totalSelling: 11500,
      totalNetCost: 10000,
      trevioSellingPrice: 11500,
      trevioMarkupAmount: 1500,
      agentMarkup: 1150,
      contractedCost: 10000,
      packages: [{ totalNetCost: 10000, totalSelling: 11500, pricing: { contractedCost: 10000, trevioMarkupAmount: 1500, trevioSellingPrice: 11500, agentMarkupAmount: 1150 } }],
    }, "customer");
    const json = JSON.stringify(quote);
    expect(json).not.toContain("10000");
    expect(json).not.toContain("1500");
    expect(json).not.toContain("11500");
    expect(quote.agentMarkup).toBeUndefined();
  });

  it("S-T. does not invent a 75% cost and keeps a missing rate unresolved", () => {
    const missing = pricePackage({
      hotels: [{ source: "CONTRACTED_PRODUCT", productType: "HOTEL", rooms: 1, sellingPrice: 8000, rateUnresolved: true }],
    }, ctx);
    expect(missing.contractedCost).toBe(0);
    expect(missing.unresolved).toBe(true);
    expect(JSON.stringify(missing)).not.toContain(String(Math.round(8000 * 0.75)));
  });

  it("U. packages are priced independently", () => {
    const a = pricePackage({ hotels: [hotel(5000)] }, { ...ctx, nights: 1, adults: 1, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    const b = pricePackage({ hotels: [hotel(9000)] }, { ...ctx, nights: 1, adults: 1, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(a.contractedCost).toBe(15000);
    expect(b.contractedCost).toBe(27000);
  });

  it("V. costing uses the stored snapshot, not a later catalogue value", () => {
    const line = { source: "CONTRACTED_PRODUCT", productType: "HOTEL", rooms: 1, nights: 1, rateSnapshot: { contractedCost: 5000, currency: "INR", rateUnit: "PER_ROOM_NIGHT", frozen: true } };
    const priced = pricePackage({ hotels: [line] }, { ...ctx, nights: 1, adults: 1, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 } });
    expect(priced.contractedCost).toBe(5000);
  });

  it("W-X. tax comes from the configured rule, and a missing rule is flagged", () => {
    const priced = pricePackage({
      hotels: [{ source: "CONTRACTED_PRODUCT", productType: "HOTEL", rooms: 1, nights: 1, rateSnapshot: { contractedCost: 10000, currency: "INR", rateUnit: "PER_ROOM_NIGHT", frozen: true } }],
    }, { ...ctx, nights: 1, adults: 1, children: 0, infants: 0, trevioMarkup: { type: "Fixed", value: 0 }, agentMarkup: { type: "Fixed", value: 0 }, taxRule: tax });
    expect(priced.taxRate).toBe(10);
    expect(priced.taxAmount).toBe(1000);
    expect(priced.finalPrice).toBe(11000);
    const missing = pricePackage({ hotels: [hotel(1000)] }, { ...ctx, nights: 1, taxRule: null });
    expect(missing.taxAmount).toBeNull();
    expect(missing.reasons).toContain(TAX_CONFIGURATION_REQUIRED);
    expect(missing.taxRate).not.toBe(18);
    expect(missing.taxRate).not.toBe(5);
  });

  it("Y-Z. currency mismatch is not 1:1, and percent rounding is deterministic", () => {
    const priced = pricePackage({
      hotels: [{ source: "CONTRACTED_PRODUCT", productType: "HOTEL", rooms: 1, nights: 1, rateSnapshot: { contractedCost: 100, currency: "USD", rateUnit: "PER_ROOM_NIGHT", frozen: true } }],
    }, { ...ctx, currency: "INR", nights: 1, exchangeRateExplicit: false, exchangeRate: 1 });
    expect(priced.currencyUnresolved).toBe(true);
    expect(priced.contractedCost).toBe(0);
    expect(priced.reasons).toContain(CURRENCY_CONVERSION_UNAVAILABLE);
    expect(percentOf(10000, 15)).toBe(1500);
    expect(percentOf(11500, 10)).toBe(1150);
    expect(percentOf(10000, 15)).toBe(percentOf(10000, 15));
  });
});
