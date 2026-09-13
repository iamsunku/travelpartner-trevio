/** Display-only costing. Server `pricePackage` is the source of truth on save. */

export type CostLine = {
  costPrice?: number;
  sellingPrice?: number;
  qty?: number;
  quantity?: number;
  adultRate?: number;
  childRate?: number;
  adults?: number;
  children?: number;
};

export function lineTotals(line: CostLine) {
  const qty = Number(line.qty ?? line.quantity ?? 1) || 1;
  let selling = Number(line.sellingPrice ?? 0);
  let cost = Number(line.costPrice ?? 0);
  if (line.adultRate != null || line.childRate != null) {
    selling =
      Number(line.adultRate || 0) * Number(line.adults || 0) +
      Number(line.childRate || 0) * Number(line.children || 0);
    if (!cost) cost = 0;
  } else {
    selling = selling * qty;
    cost = cost * qty;
  }
  return { cost, selling, profit: selling - cost };
}

export function sumServiceLines(lines: unknown): { cost: number; selling: number } {
  if (!Array.isArray(lines)) return { cost: 0, selling: 0 };
  return lines.reduce(
    (acc, line) => {
      const t = lineTotals(line as CostLine);
      return { cost: acc.cost + t.cost, selling: acc.selling + t.selling };
    },
    { cost: 0, selling: 0 },
  );
}

export function calcPackageCosting(pkg: {
  hotels?: unknown;
  flights?: unknown;
  transfers?: unknown;
  activities?: unknown;
  meals?: unknown;
  addOns?: unknown;
  visa?: { enabled?: boolean; costPrice?: number; sellingPrice?: number } | null;
  insurance?: { enabled?: boolean; costPrice?: number; sellingPrice?: number } | null;
  taxRate?: number;
  discountType?: string | null;
  discountValue?: number;
  adults?: number;
  children?: number;
  infants?: number;
}) {
  const parts = [
    sumServiceLines(pkg.hotels),
    sumServiceLines(pkg.flights),
    sumServiceLines(pkg.transfers),
    sumServiceLines(pkg.activities),
    sumServiceLines(pkg.meals),
    sumServiceLines(pkg.addOns),
  ];
  let totalNetCost = parts.reduce((s, p) => s + p.cost, 0);
  let totalSelling = parts.reduce((s, p) => s + p.selling, 0);
  if (pkg.visa?.enabled) {
    totalNetCost += Number(pkg.visa.costPrice || 0);
    totalSelling += Number(pkg.visa.sellingPrice || 0);
  }
  if (pkg.insurance?.enabled) {
    totalNetCost += Number(pkg.insurance.costPrice || 0);
    totalSelling += Number(pkg.insurance.sellingPrice || 0);
  }

  let discountAmount = 0;
  if (pkg.discountType === "Percentage") {
    discountAmount = Math.round(totalSelling * (Number(pkg.discountValue || 0) / 100));
  } else if (pkg.discountType === "Fixed") {
    discountAmount = Math.round(Number(pkg.discountValue || 0));
  }
  discountAmount = Math.min(discountAmount, totalSelling);
  const afterDiscount = totalSelling - discountAmount;
  const taxRate = Number(pkg.taxRate ?? 0);
  const gst = taxRate > 0 ? Math.round(afterDiscount * (taxRate / 100)) : 0;
  const taxableAmount = afterDiscount - gst;
  const grossProfit = afterDiscount - totalNetCost;
  const profitMargin = afterDiscount > 0 ? (grossProfit / afterDiscount) * 100 : 0;
  const pax = Math.max(1, Number(pkg.adults || 0) + Number(pkg.children || 0));
  const perPersonCost = Math.round(afterDiscount / pax);

  return {
    totalNetCost,
    totalSelling: afterDiscount,
    grossProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    discountAmount,
    taxableAmount,
    gst,
    total: afterDiscount,
    perPersonCost,
  };
}

export type ResolvedQuoteCosting = {
  packageBase: number;
  gst: number;
  total: number;
  taxRate: number;
  totalNetCost: number;
  grossProfit: number;
  profitMargin: number;
  perPersonCost: number;
  discountAmount: number;
  perAdultPrice: number;
  perChildPrice: number;
  trevioSellingPrice?: number;
  trevioMarkupAmount?: number;
  agentMarkupAmount?: number;
  taxConfigured?: boolean;
  adults: number;
  children: number;
  infants: number;
  roomCount: number;
  checkIn?: string;
  checkOut?: string;
  source: "packages" | "stored" | "derived";
};

/** Fallback only, when a stored pricing layer is not available. Equal split across adults and children; infants are not given an invented rate. */
export function derivePaxRates(packageBase: number, adults: number, children: number) {
  const a = Math.max(0, Number(adults) || 0);
  const c = Math.max(0, Number(children) || 0);
  const paying = a + c;
  if (paying <= 0) return { perAdultPrice: 0, perChildPrice: 0 };
  const perAdultPrice = Math.round(packageBase / paying);
  const perChildPrice = c > 0 ? perAdultPrice : 0;
  return { perAdultPrice, perChildPrice };
}

function roomCountFromHotels(hotels: unknown, adults: number, children: number): number {
  if (Array.isArray(hotels) && hotels.length) {
    const sum = hotels.reduce((s, h) => s + (Number((h as { rooms?: number }).rooms) || 0), 0);
    if (sum > 0) return sum;
  }
  return Math.max(1, Math.ceil((Math.max(0, adults) + Math.max(0, children)) / 3));
}

function isCalendarDate(value?: string): boolean {
  if (!value) return false;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  if (/^\d{1,2}:\d{2}/.test(v) || /am|pm/i.test(v)) return false;
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return !Number.isNaN(d.getTime()) && v.length >= 8;
}

function hotelDates(hotels: unknown): { checkIn?: string; checkOut?: string } {
  if (!Array.isArray(hotels) || !hotels.length) return {};
  const first = hotels[0] as { checkIn?: string; checkOut?: string };
  return {
    checkIn: isCalendarDate(first.checkIn) ? first.checkIn : undefined,
    checkOut: isCalendarDate(first.checkOut) ? first.checkOut : undefined,
  };
}

/**
 * Prefer live package lines; else stored DB fields; else derive from amount/gst/total
 * so older quotes (zeros for net/profit) still show a sensible breakdown.
 */
export function resolveQuotationCosting(quote: {
  amount?: number;
  gst?: number;
  total?: number;
  taxRate?: number;
  totalNetCost?: number | null;
  grossProfit?: number | null;
  profitMargin?: number | null;
  perPersonCost?: number | null;
  discountAmount?: number | null;
  discountType?: string | null;
  discountValue?: number;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  packages?: Array<Record<string, unknown>> | null;
}): ResolvedQuoteCosting {
  const adults = Math.max(0, Number(quote.adults ?? 2));
  const children = Math.max(0, Number(quote.children ?? 0));
  const infants = Math.max(0, Number(quote.infants ?? 0));
  const taxRate = Number(quote.taxRate ?? 0);
  const packages = Array.isArray(quote.packages) ? quote.packages : [];
  const selected =
    packages.find((p) => p.isSelected) ||
    packages[0] ||
    null;

  const storedPricing = selected?.pricing as {
    contractedCost?: number;
    trevioMarkupAmount?: number;
    trevioSellingPrice?: number;
    customerPrice?: number;
    taxAmount?: number | null;
    taxRate?: number | null;
    finalPrice?: number | null;
    perAdultPrice?: number;
    perChildPrice?: number;
    discountAmount?: number;
    agentMarkupAmount?: number;
    unresolved?: boolean;
  } | null;
  if (storedPricing && (storedPricing.contractedCost != null || storedPricing.customerPrice != null)) {
    const dates = hotelDates(selected?.hotels);
    return {
      packageBase: Number(storedPricing.customerPrice ?? 0),
      gst: Number(storedPricing.taxAmount ?? 0),
      total: Number(storedPricing.finalPrice ?? storedPricing.customerPrice ?? 0),
      taxRate: Number(storedPricing.taxRate ?? 0),
      totalNetCost: Number(storedPricing.contractedCost ?? 0),
      grossProfit: Number(storedPricing.trevioSellingPrice ?? 0) - Number(storedPricing.contractedCost ?? 0),
      profitMargin: 0,
      perPersonCost: Number(storedPricing.perAdultPrice ?? 0),
      discountAmount: Number(storedPricing.discountAmount ?? 0),
      perAdultPrice: Number(storedPricing.perAdultPrice ?? 0),
      perChildPrice: Number(storedPricing.perChildPrice ?? 0),
      trevioSellingPrice: Number(storedPricing.trevioSellingPrice ?? 0),
      trevioMarkupAmount: Number(storedPricing.trevioMarkupAmount ?? 0),
      agentMarkupAmount: Number(storedPricing.agentMarkupAmount ?? 0),
      taxConfigured: storedPricing.taxAmount != null,
      adults,
      children,
      infants,
      roomCount: roomCountFromHotels(selected?.hotels, adults, children),
      checkIn: dates.checkIn || quote.travelStartDate || undefined,
      checkOut: dates.checkOut || quote.travelEndDate || undefined,
      source: "stored",
    };
  }

  if (selected) {
    const live = calcPackageCosting({
      hotels: selected.hotels,
      flights: selected.flights,
      transfers: selected.transfers,
      activities: selected.activities,
      meals: selected.meals,
      addOns: selected.addOns,
      visa: selected.visa as { enabled?: boolean; costPrice?: number; sellingPrice?: number } | null,
      insurance: selected.insurance as { enabled?: boolean; costPrice?: number; sellingPrice?: number } | null,
      taxRate,
      discountType: quote.discountType || null,
      discountValue: Number(quote.discountValue || 0),
      adults,
      children,
      infants,
    });
    if (live.total > 0 || live.totalNetCost > 0) {
      const packageBase = live.taxableAmount > 0 ? live.taxableAmount : Math.max(0, live.total - live.gst);
      const rates = derivePaxRates(packageBase, adults, children);
      const dates = hotelDates(selected.hotels);
      return {
        packageBase,
        gst: live.gst,
        total: live.total,
        taxRate,
        totalNetCost: live.totalNetCost,
        grossProfit: live.grossProfit,
        profitMargin: live.profitMargin,
        perPersonCost: live.perPersonCost,
        discountAmount: live.discountAmount,
        ...rates,
        adults,
        children,
        infants,
        roomCount: roomCountFromHotels(selected.hotels, adults, children),
        checkIn: dates.checkIn || quote.travelStartDate || undefined,
        checkOut: dates.checkOut || quote.travelEndDate || undefined,
        source: "packages",
      };
    }
  }

  const storedNet = Number(quote.totalNetCost || 0);
  const storedTotal = Number(quote.total || 0);
  const storedGst = Number(quote.gst || 0);
  const storedAmount = Number(quote.amount || 0);
  const exclusive = storedTotal > 0 && storedAmount > 0 && storedAmount + storedGst === storedTotal;
  const packageBase = exclusive
    ? storedAmount
    : storedAmount > storedGst
      ? Math.max(0, (storedAmount || storedTotal) - storedGst)
      : Math.max(0, storedTotal - storedGst);
  const total = storedTotal || packageBase + storedGst;
  const gst = storedGst || Math.round(packageBase * (taxRate / 100));

  let totalNetCost = storedNet;
  let grossProfit = Number(quote.grossProfit || 0);
  let profitMargin = Number(quote.profitMargin || 0);
  let perPersonCost = Number(quote.perPersonCost || 0);
  let source: ResolvedQuoteCosting["source"] = "stored";

  if (totalNetCost <= 0 && packageBase > 0) {
    source = "stored";
  }
  if ((grossProfit === 0 || quote.grossProfit == null) && packageBase > 0) {
    grossProfit = packageBase - totalNetCost;
    if (storedNet <= 0) source = "derived";
  }
  if ((profitMargin === 0 || quote.profitMargin == null) && packageBase > 0) {
    profitMargin = Math.round((grossProfit / packageBase) * 10000) / 100;
  }
  if (perPersonCost <= 0) {
    const pax = Math.max(1, adults + children);
    perPersonCost = Math.round((exclusive ? packageBase : total) / pax);
    if (!quote.perPersonCost) source = "derived";
  }

  const rates = derivePaxRates(packageBase, adults, children);
  return {
    packageBase,
    gst,
    total,
    taxRate,
    totalNetCost,
    grossProfit,
    profitMargin,
    perPersonCost,
    discountAmount: Number(quote.discountAmount || 0),
    ...rates,
    adults,
    children,
    infants,
    roomCount: roomCountFromHotels(selected?.hotels, adults, children),
    checkIn: quote.travelStartDate || undefined,
    checkOut: quote.travelEndDate || undefined,
    source,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function previewLineCost(line: Record<string, unknown>, nights: number | null, adults: number, children: number, infants: number): number | null {
  if (line.includedInPlan === true || line.included === true) return 0;
  const snap = asRecord(line.rateSnapshot);
  const unit = typeof snap?.contractedCost === "number" ? Math.round(snap.contractedCost) : typeof line.costPrice === "number" ? Math.round(line.costPrice) : typeof line.fare === "number" ? Math.round(line.fare) : null;
  if (unit == null) return null;
  const rateUnit = String(snap?.rateUnit || "");
  const qty = Math.max(1, Math.round(Number(line.quantity ?? line.qty ?? 1) || 1));
  if (rateUnit === "PER_ROOM_NIGHT" || (snap && line.productType === "HOTEL")) {
    const rooms = Math.round(Number(line.rooms ?? 0) || 0);
    const stay = nights && nights > 0 ? nights : Math.round(Number(line.nights) || 0);
    if (rooms <= 0 || stay <= 0) return null;
    const meta = asRecord(snap?.metadata);
    const child = typeof meta?.childCost === "number" ? meta.childCost * children * stay : 0;
    const infant = typeof meta?.infantCost === "number" ? meta.infantCost * infants * stay : 0;
    return unit * rooms * stay + child + infant;
  }
  if (rateUnit === "PER_VEHICLE" || rateUnit === "PER_TRANSFER" || (snap && line.productType === "TRANSFER")) {
    const capacity = Math.round(Number(line.capacity ?? 0) || 0);
    const pax = adults + children + infants;
    const vehicles = capacity > 0 ? Math.max(1, Math.ceil(pax / capacity)) * qty : qty;
    return unit * vehicles;
  }
  if (!snap && (line.source === "AMADEUS_API" || line.source === "API" || line.source === "MANUAL")) return unit;
  const meta = asRecord(snap?.metadata);
  const childRate = typeof meta?.childCost === "number" ? meta.childCost : 0;
  const infantRate = typeof meta?.infantCost === "number" ? meta.infantCost : 0;
  return (unit * adults + childRate * children + infantRate * infants) * qty;
}

/** Staff preview only. Final amounts are recalculated on the server from the rate snapshot. */
export function previewPackageLayers(input: {
  hotels?: unknown;
  flights?: unknown;
  transfers?: unknown;
  activities?: unknown;
  meals?: unknown;
  adults?: number;
  children?: number;
  infants?: number;
  nights?: number | null;
  trevioMarkupValue?: number;
  agentMarkup?: number;
  agentMarkupType?: string;
  discountType?: string | null;
  discountValue?: number;
}) {
  const adults = Math.max(0, Number(input.adults || 0));
  const children = Math.max(0, Number(input.children || 0));
  const infants = Math.max(0, Number(input.infants || 0));
  let contracted = 0;
  let unresolved = false;
  for (const rows of [input.hotels, input.flights, input.transfers, input.activities, input.meals]) {
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      const line = asRecord(raw);
      if (!line) continue;
      const cost = previewLineCost(line, input.nights ?? null, adults, children, infants);
      if (cost == null) unresolved = true;
      else contracted += cost;
    }
  }
  const markup = Math.round(contracted * (Number(input.trevioMarkupValue || 0) / 100));
  let selling = contracted + markup;
  let discountAmount = 0;
  if (input.discountType === "Percentage") discountAmount = Math.min(selling, Math.round(selling * (Number(input.discountValue || 0) / 100)));
  else if (input.discountType === "Fixed") discountAmount = Math.min(selling, Math.round(Number(input.discountValue || 0)));
  selling -= discountAmount;
  const agentAmount = input.agentMarkupType === "Percentage"
    ? Math.round(selling * (Number(input.agentMarkup || 0) / 100))
    : Math.max(0, Math.round(Number(input.agentMarkup || 0)));
  const customer = selling + agentAmount;
  const paying = adults + children;
  return {
    totalNetCost: contracted,
    totalSelling: selling,
    grossProfit: selling - contracted,
    profitMargin: selling > 0 ? Math.round(((selling - contracted) / selling) * 10000) / 100 : 0,
    discountAmount,
    taxableAmount: customer,
    gst: 0,
    total: customer,
    perPersonCost: paying > 0 ? Math.round(customer / paying) : 0,
    trevioMarkupAmount: markup,
    agentMarkupAmount: agentAmount,
    unresolved,
  };
}
