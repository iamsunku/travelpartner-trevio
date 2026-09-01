import { resolveGstState } from "./gst-state.js";

export type InvoiceLineItem = {
  description: string;
  amount: number;
};

export type GstBreakdown = {
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  total: number;
  gstType: "intra" | "inter";
};

export type ProductAccess = {
  flights: boolean;
  hotels: boolean;
  packages: boolean;
};

export const DEFAULT_PRODUCT_ACCESS: ProductAccess = {
  flights: false,
  hotels: true,
  packages: true,
};

export function parseProductAccess(raw: unknown, role?: string | null): ProductAccess {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      flights: Boolean(o.flights),
      hotels: o.hotels !== false,
      packages: o.packages !== false,
    };
  }
  if (role === "travel_agent") return { ...DEFAULT_PRODUCT_ACCESS };
  return { flights: true, hotels: true, packages: true };
}

export { resolveGstState, stateFromGstin } from "./gst-state.js";

export function computeTravelGst(
  packageValue: number,
  agencyState?: string | null,
  customerState?: string | null,
  gstRate = 5,
  customerGstin?: string | null,
  agencyGstin?: string | null,
): GstBreakdown {
  const total = packageValue;
  const totalGst = Math.round((total * gstRate) / (100 + gstRate));
  const taxableAmount = total - totalGst;
  const agency = String(resolveGstState(agencyState, agencyGstin) || "").trim().toLowerCase();
  const customer = String(resolveGstState(customerState, customerGstin) || "").trim().toLowerCase();
  const isIntra = Boolean(agency && customer && agency === customer);
  if (isIntra) {
    const half = Math.round(totalGst / 2);
    return {
      taxableAmount,
      gstRate,
      cgst: half,
      sgst: totalGst - half,
      igst: 0,
      totalGst,
      total,
      gstType: "intra",
    };
  }
  return {
    taxableAmount,
    gstRate,
    cgst: 0,
    sgst: 0,
    igst: totalGst,
    totalGst,
    total,
    gstType: "inter",
  };
}

export function buildInvoiceLineItems(booking: {
  bookingRef: string;
  destination?: string | null;
  route?: string;
  packageValue?: number | null;
  amount: number;
  amountPaid?: number;
  balanceAmount?: number;
  packageIncludes?: unknown;
  addOns?: { title: string; amount: number }[];
  services?: { serviceType: string; title: string; sellingPrice: number }[];
}): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const pkgAmount = booking.packageValue ?? booking.amount;
  items.push({
    description: `Holiday package — ${booking.destination || booking.route || booking.bookingRef}`,
    amount: pkgAmount,
  });
  for (const addon of booking.addOns || []) {
    if (addon.amount > 0) {
      items.push({ description: `Add-on: ${addon.title}`, amount: addon.amount });
    }
  }
  const includes = Array.isArray(booking.packageIncludes) ? booking.packageIncludes : [];
  for (const inc of includes.slice(0, 6)) {
    items.push({ description: String(inc), amount: 0 });
  }
  items.push({ description: "Amount paid", amount: booking.amountPaid ?? 0 });
  items.push({ description: "Balance due", amount: booking.balanceAmount ?? 0 });
  return items;
}
