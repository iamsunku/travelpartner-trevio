/** Display-only costing. Server `calcPackageCosting` is the source of truth on save. */

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
    if (!cost) cost = Math.round(selling * 0.75);
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
  const taxRate = Number(pkg.taxRate ?? 18);
  const gst = Math.round(afterDiscount * (taxRate / (100 + taxRate)));
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
  adults: number;
  children: number;
  infants: number;
  roomCount: number;
  checkIn?: string;
  checkOut?: string;
  source: "packages" | "stored" | "derived";
};

/** Split a package base across adults/children (child ≈ 66% of adult). */
export function derivePaxRates(packageBase: number, adults: number, children: number) {
  const a = Math.max(0, Number(adults) || 0);
  const c = Math.max(0, Number(children) || 0);
  const childFactor = 0.66;
  const weight = a + c * childFactor;
  if (weight <= 0) {
    return { perAdultPrice: Math.round(packageBase), perChildPrice: 0 };
  }
  const perAdultPrice = Math.round(packageBase / weight);
  const perChildPrice = Math.round(perAdultPrice * childFactor);
  return { perAdultPrice, perChildPrice };
}

function roomCountFromHotels(hotels: unknown, adults: number, children: number): number {
  if (Array.isArray(hotels) && hotels.length) {
    const sum = hotels.reduce((s, h) => s + (Number((h as { rooms?: number }).rooms) || 0), 0);
    if (sum > 0) return sum;
  }
  return Math.max(1, Math.ceil((Math.max(0, adults) + Math.max(0, children)) / 3));
}

function hotelDates(hotels: unknown): { checkIn?: string; checkOut?: string } {
  if (!Array.isArray(hotels) || !hotels.length) return {};
  const first = hotels[0] as { checkIn?: string; checkOut?: string };
  return {
    checkIn: first.checkIn || undefined,
    checkOut: first.checkOut || undefined,
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
  const taxRate = Number(quote.taxRate ?? 18);
  const packages = Array.isArray(quote.packages) ? quote.packages : [];
  const selected =
    packages.find((p) => p.isSelected) ||
    packages[0] ||
    null;

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
    totalNetCost = Math.round(packageBase * 0.75);
    source = "derived";
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
