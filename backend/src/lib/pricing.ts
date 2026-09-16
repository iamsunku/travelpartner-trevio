/** Quotation pricing layers. Integer currency units. Not the legacy inclusive-tax extractor. */

export const RATE_UNITS = [
  "PER_ROOM_NIGHT",
  "PER_ADULT",
  "PER_CHILD",
  "PER_INFANT",
  "PER_PASSENGER",
  "PER_VEHICLE",
  "PER_TRANSFER",
  "PER_ACTIVITY",
  "PER_MEAL",
] as const;

export type RateUnit = (typeof RATE_UNITS)[number];

export const TAX_CONFIGURATION_REQUIRED = "Tax configuration required.";
export const CURRENCY_CONVERSION_UNAVAILABLE = "Currency conversion is not configured for this contracted rate.";

export type TaxMethod = "EXCLUSIVE" | "INCLUSIVE";

export type TaxRuleInput = {
  id: string;
  name: string;
  rate: number;
  method: TaxMethod;
  active: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type MarkupSpec = {
  type: "Percentage" | "Fixed";
  value: number;
};

export type PriceLayers = {
  contractedCost: number;
  trevioMarkupAmount: number;
  trevioSellingPrice: number;
  discountAmount: number;
  agentMarkupAmount: number;
  customerPrice: number;
  taxName: string | null;
  taxRate: number | null;
  taxMethod: TaxMethod | null;
  taxAmount: number | null;
  finalPrice: number | null;
  perAdultPrice: number;
  perChildPrice: number;
  unresolved: boolean;
  reasons: string[];
};

export type QuotePricingContext = {
  currency: string;
  nights?: number | null;
  adults: number;
  children: number;
  infants: number;
  trevioMarkup: MarkupSpec;
  agentMarkup: MarkupSpec;
  discountType?: string | null;
  discountValue?: number;
  taxRule?: TaxRuleInput | null;
  asOfDate?: string | null;
  exchangeRate?: number | null;
  exchangeRateExplicit?: boolean;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function percentOf(amount: number, percent: number): number {
  const base = Math.round(amount);
  const basisPoints = Math.round(Number(percent) * 100);
  if (!Number.isFinite(base) || !Number.isFinite(basisPoints)) return 0;
  const sign = base < 0 ? -1 : 1;
  const raw = Math.abs(base) * Math.abs(basisPoints);
  return sign * Math.round(raw / 10000);
}

export function defaultRateUnit(productType: string | undefined): RateUnit {
  if (productType === "HOTEL") return "PER_ROOM_NIGHT";
  if (productType === "TRANSFER") return "PER_VEHICLE";
  if (productType === "ACTIVITY") return "PER_PASSENGER";
  if (productType === "MEAL") return "PER_PASSENGER";
  if (productType === "FLIGHT") return "PER_PASSENGER";
  return "PER_PASSENGER";
}

export function isRateUnit(value: unknown): value is RateUnit {
  return typeof value === "string" && (RATE_UNITS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isoNights(from: unknown, to: unknown): number | null {
  if (typeof from !== "string" || typeof to !== "string" || !ISO.test(from) || !ISO.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / 86400000);
}

function unitOf(line: Record<string, unknown>): RateUnit {
  const snap = asRecord(line.rateSnapshot);
  if (isRateUnit(snap?.rateUnit)) return snap.rateUnit;
  if (isRateUnit(line.rateUnit)) return line.rateUnit;
  return defaultRateUnit(typeof line.productType === "string" ? line.productType : undefined);
}

function snapshotCost(line: Record<string, unknown>): number | null {
  const snap = asRecord(line.rateSnapshot);
  if (snap && typeof snap.contractedCost === "number" && Number.isFinite(snap.contractedCost)) {
    return Math.round(snap.contractedCost);
  }
  return null;
}

function childExtra(line: Record<string, unknown>): number | null {
  const snap = asRecord(line.rateSnapshot);
  const meta = asRecord(snap?.metadata) || asRecord(line.metadata);
  const value = meta?.childCost ?? line.childCost;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function infantExtra(line: Record<string, unknown>): number | null {
  const snap = asRecord(line.rateSnapshot);
  const meta = asRecord(snap?.metadata) || asRecord(line.metadata);
  const value = meta?.infantCost ?? line.infantCost;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function lineCurrency(line: Record<string, unknown>): string {
  const snap = asRecord(line.rateSnapshot);
  return String(snap?.currency || line.currency || "INR");
}

export type LineCost = {
  contractedCost: number;
  adultAttributed: number;
  childAttributed: number;
  shared: number;
  unresolved: boolean;
  reason?: string;
  currencyUnresolved?: boolean;
};

export function priceLine(
  line: Record<string, unknown>,
  ctx: Pick<QuotePricingContext, "currency" | "nights" | "adults" | "children" | "infants" | "exchangeRate" | "exchangeRateExplicit">,
): LineCost {
  if (line.includedInPlan === true || line.included === true) {
    return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: false };
  }
  const source = String(line.source || "");
  const contracted = source === "CONTRACTED_PRODUCT" || Boolean(line.productId && line.rateSnapshot);
  if (line.rateUnresolved === true && contracted) {
    return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, reason: "No valid contracted rate available for selected travel date." };
  }

  let unitCost: number | null = null;
  if (contracted || source === "CONTRACTED_PRODUCT") {
    unitCost = snapshotCost(line);
    if (unitCost == null) {
      return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, reason: "No valid contracted rate available for selected travel date." };
    }
  } else if (source === "AMADEUS_API" || source === "API" || source === "MOCK" || source === "MANUAL" || !source) {
    // Self-booked hotels/flights are operational lines unless the user supplies an explicit commercial amount.
    if (typeof line.costPrice === "number" && Number.isFinite(line.costPrice)) unitCost = Math.round(line.costPrice);
    else if (typeof line.fare === "number" && Number.isFinite(line.fare)) unitCost = Math.round(line.fare);
    else if (typeof line.sellingPrice === "number" && Number.isFinite(line.sellingPrice)) unitCost = Math.round(line.sellingPrice);
    if (unitCost == null && line.selfBooked === true) {
      return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: false };
    }
    if (unitCost == null) {
      return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, reason: "No explicit cost or fare for this manual or API item." };
    }
  } else {
    return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, reason: "No valid contracted rate available for selected travel date." };
  }

  const converted = convertAmount(unitCost, lineCurrency(line), ctx);
  if (converted.unavailable) {
    return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, currencyUnresolved: true, reason: CURRENCY_CONVERSION_UNAVAILABLE };
  }
  unitCost = converted.amount;

  const adults = Math.max(0, Number(line.adults ?? ctx.adults) || 0);
  const children = Math.max(0, Number(line.children ?? ctx.children) || 0);
  const infants = Math.max(0, Number(line.infants ?? ctx.infants) || 0);
  if (!(contracted || source === "CONTRACTED_PRODUCT")) {
    return splitShared(unitCost, adults, children);
  }
  const appliedUnit = unitOf(line);

  const child = childExtra(line);
  const infant = infantExtra(line);
  const qty = Math.max(1, Math.round(Number(line.quantity ?? line.qty ?? line.occurrences ?? 1) || 1));

  if (appliedUnit === "PER_ROOM_NIGHT") {
    const rooms = Math.round(Number(line.rooms ?? 0) || 0);
    const nights = isoNights(line.checkIn, line.checkOut) ?? (Number(line.nights) > 0 ? Math.round(Number(line.nights)) : (ctx.nights && ctx.nights > 0 ? ctx.nights : null));
    if (rooms <= 0) return fail("Room count is required for a room-night hotel rate.");
    if (!nights) return fail("Night count is required for a room-night hotel rate.");
    const roomCost = unitCost * rooms * nights;
    const childPart = child != null ? child * children * nights : 0;
    const infantPart = infant != null ? infant * infants * nights : 0;
    return {
      contractedCost: roomCost + childPart + infantPart,
      adultAttributed: 0,
      childAttributed: childPart,
      shared: roomCost,
      unresolved: false,
    };
  }

  if (appliedUnit === "PER_VEHICLE" || appliedUnit === "PER_TRANSFER") {
    const capacity = Math.round(Number(line.capacity ?? 0) || 0);
    const pax = adults + children + infants;
    const vehicles = capacity > 0 ? Math.max(1, Math.ceil(pax / capacity)) * qty : qty;
    return splitShared(unitCost * vehicles, adults, children);
  }

  if (appliedUnit === "PER_ACTIVITY" || appliedUnit === "PER_MEAL") {
    return splitShared(unitCost * qty, adults, children);
  }

  if (appliedUnit === "PER_ADULT") return attributed(unitCost * adults * qty, 0, 0);
  if (appliedUnit === "PER_CHILD") return attributed(0, (child ?? unitCost) * children * qty, 0);
  if (appliedUnit === "PER_INFANT") return attributed(0, 0, (infant ?? unitCost) * infants * qty);

  const adultPart = unitCost * adults * qty;
  const childPart = child == null ? 0 : child * children * qty;
  const infantPart = infant == null ? 0 : infant * infants * qty;
  return attributed(adultPart, childPart, infantPart);
}

function fail(reason: string): LineCost {
  return { contractedCost: 0, adultAttributed: 0, childAttributed: 0, shared: 0, unresolved: true, reason };
}

function splitShared(amount: number, adults: number, children: number): LineCost {
  const paying = adults + children;
  if (paying <= 0) {
    return { contractedCost: amount, adultAttributed: 0, childAttributed: 0, shared: amount, unresolved: false };
  }
  return { contractedCost: amount, adultAttributed: 0, childAttributed: 0, shared: amount, unresolved: false };
}

function attributed(adult: number, child: number, infant = 0): LineCost {
  return { contractedCost: adult + child + infant, adultAttributed: adult, childAttributed: child, shared: 0, unresolved: false };
}

export function convertAmount(
  amount: number,
  from: string,
  ctx: Pick<QuotePricingContext, "currency" | "exchangeRate" | "exchangeRateExplicit">,
): { amount: number; unavailable?: boolean } {
  const quoteCurrency = ctx.currency || "INR";
  if (!from || from === quoteCurrency) return { amount };
  if (!ctx.exchangeRateExplicit || !(Number(ctx.exchangeRate) > 0)) return { amount: 0, unavailable: true };
  return { amount: Math.round(amount * Number(ctx.exchangeRate)) };
}

export function applyMarkup(base: number, markup: MarkupSpec): { amount: number; result: number } {
  if (markup.type === "Fixed") {
    const amount = Math.max(0, Math.round(Number(markup.value) || 0));
    return { amount, result: base + amount };
  }
  const amount = Math.max(0, percentOf(base, Number(markup.value) || 0));
  return { amount, result: base + amount };
}

export function discountAmount(base: number, type?: string | null, value?: number): number {
  if (type === "Percentage") return Math.min(base, Math.max(0, percentOf(base, Number(value) || 0)));
  if (type === "Fixed") return Math.min(base, Math.max(0, Math.round(Number(value) || 0)));
  return 0;
}

export function taxForRule(base: number, rule: TaxRuleInput | null | undefined, asOf?: string | null): {
  required: boolean;
  amount: number | null;
  rate: number | null;
  method: TaxMethod | null;
  name: string | null;
  ruleId: string | null;
} {
  if (!rule || !rule.active || !ruleApplies(rule, asOf)) {
    return { required: true, amount: null, rate: null, method: null, name: null, ruleId: null };
  }
  if (rule.method === "INCLUSIVE") {
    const bps = Math.round(rule.rate * 100);
    const amount = Math.round((base * bps) / (10000 + bps));
    return { required: false, amount, rate: rule.rate, method: "INCLUSIVE", name: rule.name, ruleId: rule.id };
  }
  const amount = percentOf(base, rule.rate);
  return { required: false, amount, rate: rule.rate, method: "EXCLUSIVE", name: rule.name, ruleId: rule.id };
}

export function ruleApplies(rule: TaxRuleInput, asOf?: string | null): boolean {
  if (!asOf || !ISO.test(asOf)) return true;
  if (rule.effectiveFrom && asOf < rule.effectiveFrom) return false;
  if (rule.effectiveTo && asOf > rule.effectiveTo) return false;
  return true;
}

const COLLECTIONS = ["hotels", "flights", "transfers", "activities", "meals", "addOns"] as const;

export function pricePackage(pkg: Record<string, unknown>, ctx: QuotePricingContext): PriceLayers & { lines: Record<string, unknown>; taxRequired: boolean; currencyUnresolved: boolean } {
  const reasons: string[] = [];
  let contractedCost = 0;
  let adultSpecific = 0;
  let childSpecific = 0;
  let shared = 0;
  let unresolved = false;
  let currencyUnresolved = false;
  const lines: Record<string, unknown> = {};

  for (const key of COLLECTIONS) {
    const rows = Array.isArray(pkg[key]) ? pkg[key] as unknown[] : [];
    lines[key] = rows.map((raw) => {
      const line = asRecord(raw);
      if (!line) return raw;
      const priced = priceLine(line, ctx);
      if (priced.unresolved) {
        unresolved = true;
        if (priced.reason) reasons.push(priced.reason);
        if (priced.currencyUnresolved) currencyUnresolved = true;
      }
      contractedCost += priced.contractedCost;
      adultSpecific += priced.adultAttributed;
      childSpecific += priced.childAttributed;
      shared += priced.shared;
      return { ...line, contractedCost: priced.contractedCost, pricingUnresolved: priced.unresolved || undefined };
    });
  }

  for (const extra of ["visa", "insurance"] as const) {
    const block = asRecord(pkg[extra]);
    if (block?.enabled && typeof block.costPrice === "number") {
      contractedCost += Math.round(block.costPrice);
      shared += Math.round(block.costPrice);
    }
  }

  const trevio = applyMarkup(contractedCost, ctx.trevioMarkup);
  const discount = discountAmount(trevio.result, ctx.discountType, ctx.discountValue);
  const trevioSellingPrice = trevio.result - discount;
  const agent = applyMarkup(trevioSellingPrice, ctx.agentMarkup);
  const customerPrice = agent.result;
  const tax = taxForRule(customerPrice, ctx.taxRule, ctx.asOfDate);
  if (tax.required) reasons.push(TAX_CONFIGURATION_REQUIRED);

  const adults = Math.max(0, ctx.adults);
  const children = Math.max(0, ctx.children);
  const paying = adults + children;
  const sharedAdult = paying > 0 ? Math.round((shared * adults) / paying) : 0;
  const sharedChild = paying > 0 ? shared - sharedAdult : 0;
  const perAdultPrice = adults > 0 ? Math.round((adultSpecific + sharedAdult) / adults) : 0;
  const perChildPrice = children > 0 ? Math.round((childSpecific + sharedChild) / children) : 0;

  const exclusive = tax.method !== "INCLUSIVE";
  const finalPrice = tax.required || tax.amount == null
    ? null
    : exclusive
      ? customerPrice + tax.amount
      : customerPrice;

  return {
    contractedCost,
    trevioMarkupAmount: trevio.amount,
    trevioSellingPrice,
    discountAmount: discount,
    agentMarkupAmount: agent.amount,
    customerPrice,
    taxName: tax.name,
    taxRate: tax.rate,
    taxMethod: tax.method,
    taxAmount: tax.amount,
    finalPrice,
    perAdultPrice,
    perChildPrice,
    unresolved: unresolved || tax.required || currencyUnresolved,
    reasons: [...new Set(reasons)],
    lines,
    taxRequired: tax.required,
    currencyUnresolved,
  };
}

export const PROTECTED_PRICING_FIELDS = [
  "contractedCost",
  "costPrice",
  "trevioMarkup",
  "trevioMarkupType",
  "trevioMarkupValue",
  "trevioMarkupAmount",
  "trevioSellingPrice",
  "quotedCostPrice",
  "supplierCost",
  "taxRate",
  "taxRuleId",
  "taxAmount",
  "gst",
] as const;

export function stripAgentPricingOverrides<T extends Record<string, unknown>>(body: T): T {
  const next = { ...body };
  for (const key of PROTECTED_PRICING_FIELDS) delete next[key];
  return next;
}

export function pricingBlockReason(layers: { unresolved?: boolean; reasons?: string[]; taxRequired?: boolean }): string | null {
  if (!layers.unresolved && !layers.taxRequired) return null;
  return layers.reasons?.[0] || TAX_CONFIGURATION_REQUIRED;
}
