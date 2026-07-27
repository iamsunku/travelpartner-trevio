const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
  AED: "AED ",
  SAR: "SAR ",
  QAR: "QAR ",
  THB: "฿",
  MYR: "RM",
  HKD: "HK$",
  NZD: "NZ$",
};

export function normalizeCurrency(currency?: string | null): string {
  const code = String(currency || "INR").trim().toUpperCase();
  return code || "INR";
}

export function currencySymbol(currency?: string | null): string {
  const code = normalizeCurrency(currency);
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

export function formatProductPrice(amount: number, currency?: string | null): string {
  const symbol = currencySymbol(currency);
  const value = Number(amount ?? 0);
  return `${symbol}${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Resolve currency + amount for catalog rows (uses pending rate fields when staged). */
export function resolveProductRate(
  item: Record<string, unknown>,
  amountKey: string,
): { amount: number; currency: string } {
  const pending =
    item.pendingRateChanges && typeof item.pendingRateChanges === "object"
      ? (item.pendingRateChanges as Record<string, unknown>)
      : null;
  const hasPendingAmount = pending && pending[amountKey] != null;
  const hasPendingCurrency = pending && pending.currency != null;

  return {
    amount: Number(hasPendingAmount ? pending![amountKey] : item[amountKey] ?? 0),
    currency: normalizeCurrency(
      hasPendingCurrency ? String(pending!.currency) : String(item.currency ?? "INR"),
    ),
  };
}

export function formatActivityPrice(item: Record<string, unknown>): string {
  const { amount, currency } = resolveProductRate(item, "adultPrice");
  return formatProductPrice(amount, currency);
}

export function formatTransferPrice(item: Record<string, unknown>): string {
  const pending =
    item.pendingRateChanges && typeof item.pendingRateChanges === "object"
      ? (item.pendingRateChanges as Record<string, unknown>)
      : null;
  const currency = normalizeCurrency(
    pending?.currency != null ? String(pending.currency) : String(item.currency ?? "INR"),
  );
  const privatePrice = Number(
    pending?.privatePrice != null ? pending.privatePrice : item.privatePrice ?? 0,
  );
  const sharedPrice = Number(
    pending?.sharedAdultPrice != null
      ? pending.sharedAdultPrice
      : pending?.sharedPrice != null
        ? pending.sharedPrice
        : item.sharedAdultPrice ?? item.sharedPrice ?? 0,
  );

  if (privatePrice && sharedPrice) {
    return `${formatProductPrice(privatePrice, currency)} / ${formatProductPrice(sharedPrice, currency)}`;
  }
  if (privatePrice) return formatProductPrice(privatePrice, currency);
  if (sharedPrice) return formatProductPrice(sharedPrice, currency);
  return "—";
}

export function formatHotelFromPrice(item: Record<string, unknown>): string {
  const pending =
    item.pendingRateChanges && typeof item.pendingRateChanges === "object"
      ? (item.pendingRateChanges as Record<string, unknown>)
      : null;
  const currency = normalizeCurrency(
    pending?.currency != null ? String(pending.currency) : String(item.currency ?? "INR"),
  );
  const rooms = Array.isArray(pending?.roomCategories)
    ? (pending!.roomCategories as Record<string, unknown>[])
    : Array.isArray(item.roomCategories)
      ? (item.roomCategories as Record<string, unknown>[])
      : [];
  const pricing = (rooms[0]?.pricing as Record<string, unknown>) ?? {};
  const price = Number(pricing.double ?? pricing.single ?? 0);
  return price ? formatProductPrice(price, currency) : "—";
}
