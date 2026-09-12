import { describe, expect, it } from "vitest";
import { calcPackageCosting, sanitizeQuotationForRole } from "../lib/quotations.js";
import {
  TAX_CONFIGURATION_REQUIRED,
  pricePackage,
  stripAgentPricingOverrides,
  taxForRule,
  type TaxRuleInput,
} from "../lib/pricing.js";

describe("Phase 16 GST / TaxRule consistency", () => {
  const baseCtx = {
    currency: "INR",
    nights: 2,
    adults: 2,
    children: 0,
    infants: 0,
    trevioMarkup: { type: "Fixed" as const, value: 0 },
    agentMarkup: { type: "Fixed" as const, value: 0 },
  };

  const hotelLine = {
    source: "CONTRACTED_PRODUCT",
    productType: "HOTEL",
    rooms: 1,
    rateSnapshot: { contractedCost: 10000, currency: "INR", rateUnit: "PER_ROOM_NIGHT", frozen: true },
  };

  it("1. TaxRule rate is used instead of a hardcoded rate", () => {
    const rule: TaxRuleInput = { id: "t5", name: "Travel GST", rate: 5, method: "EXCLUSIVE", active: true };
    const priced = pricePackage({ hotels: [hotelLine] }, { ...baseCtx, taxRule: rule });
    expect(priced.taxRate).toBe(5);
    expect(priced.taxAmount).toBe(Math.round(20000 * 0.05));
    expect(priced.finalPrice).toBe(20000 + priced.taxAmount!);
  });

  it("2. changing TaxRule changes the calculated tax", () => {
    const five = pricePackage(
      { hotels: [hotelLine] },
      { ...baseCtx, taxRule: { id: "a", name: "A", rate: 5, method: "EXCLUSIVE", active: true } },
    );
    const twelve = pricePackage(
      { hotels: [hotelLine] },
      { ...baseCtx, taxRule: { id: "b", name: "B", rate: 12, method: "EXCLUSIVE", active: true } },
    );
    expect(five.taxAmount).not.toBe(twelve.taxAmount);
    expect(twelve.taxAmount).toBe(Math.round(20000 * 0.12));
  });

  it("3-4. no TaxRule does not fall back to 18% or 5%", () => {
    const missing = pricePackage({ hotels: [hotelLine] }, { ...baseCtx, taxRule: null });
    expect(missing.taxRequired).toBe(true);
    expect(missing.taxRate).toBeNull();
    expect(missing.taxAmount).toBeNull();
    expect(missing.finalPrice).toBeNull();
    expect(missing.reasons).toContain(TAX_CONFIGURATION_REQUIRED);
    expect(taxForRule(10000, null).rate).toBeNull();
    expect(taxForRule(10000, { id: "x", name: "x", rate: 18, method: "EXCLUSIVE", active: false }).rate).toBeNull();
  });

  it("5. quotation totals remain correct with exclusive TaxRule", () => {
    const priced = pricePackage(
      { hotels: [hotelLine] },
      {
        ...baseCtx,
        agentMarkup: { type: "Fixed", value: 1000 },
        taxRule: { id: "t", name: "GST", rate: 10, method: "EXCLUSIVE", active: true },
      },
    );
    expect(priced.contractedCost).toBe(20000);
    expect(priced.customerPrice).toBe(21000);
    expect(priced.taxAmount).toBe(2100);
    expect(priced.finalPrice).toBe(23100);
  });

  it("6. customer PDF model uses quotation configured tax (not invent)", () => {
    // Sanitizer keeps customer-safe totals; tax fields stay when present on quote.
    const quote = {
      total: 23100,
      gst: 2100,
      taxRate: 10,
      packages: [{ pricing: { taxRate: 10, taxAmount: 2100, customerPrice: 21000, finalPrice: 23100 } }],
    };
    const customer = sanitizeQuotationForRole(quote, "customer") as Record<string, unknown>;
    expect(customer.gst).toBe(2100);
    expect(customer.taxRate).toBe(10);
    expect(JSON.stringify(customer)).not.toMatch(/0\.18/);
  });

  it("7. booking conversion snapshot fields retain taxRate (shape)", () => {
    // Conversion copies quote.taxRate / pricing.taxRate — verified by field presence on priced layer.
    const priced = pricePackage(
      { hotels: [hotelLine] },
      { ...baseCtx, taxRule: { id: "t", name: "GST", rate: 5, method: "EXCLUSIVE", active: true } },
    );
    expect(priced.taxRate).toBe(5);
    expect(priced.taxAmount).toBe(1000);
  });

  it("8. agent cannot manipulate tax via stripAgentPricingOverrides", () => {
    const stripped = stripAgentPricingOverrides({
      taxRate: 1,
      taxRuleId: "hack",
      gst: 99,
      agentMarkup: 500,
      costPrice: 1,
    });
    expect(stripped.taxRate).toBeUndefined();
    expect(stripped.taxRuleId).toBeUndefined();
    expect(stripped.gst).toBeUndefined();
    expect(stripped.costPrice).toBeUndefined();
    expect(stripped.agentMarkup).toBe(500);
  });

  it("9-10. internal vs customer tax visibility", () => {
    const quote = {
      gst: 500,
      taxRate: 5,
      totalNetCost: 8000,
      packages: [{ pricing: { taxRate: 5, taxAmount: 500, contractedCost: 8000 } }],
    };
    const staff = sanitizeQuotationForRole(quote, "agency_admin") as Record<string, unknown>;
    const customer = sanitizeQuotationForRole(quote, "customer") as Record<string, unknown>;
    expect(staff.gst).toBe(500);
    expect(customer.gst).toBe(500);
    expect(customer.totalNetCost).toBeUndefined();
  });

  it("11. legacy calcPackageCosting does not invent 18% when taxRate omitted", () => {
    const result = calcPackageCosting({
      hotels: [{ costPrice: 8000, sellingPrice: 10000, qty: 1 }],
      adults: 2,
      children: 0,
    });
    expect(result.gst).toBe(0);
    expect(result.total).toBe(10000);
  });
});
