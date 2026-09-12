/**
 * Phase 12 — Map search / catalogue / manual inputs onto quotation flight lines
 * without inventing a second pricing engine. Pricing remains Phase 3.
 */

export type FlightSource = "AMADEUS_API" | "MANUAL" | "CONTRACTED_PRODUCT";

/** Customer-safe search result fields (never includes provider credentials). */
export function publicFlightSearchResult(raw: Record<string, unknown>) {
  return {
    id: String(raw.id || ""),
    airline: String(raw.airline || ""),
    airlineCode: String(raw.airlineCode || ""),
    flightNumber: String(raw.flightNumber || ""),
    origin: String(raw.origin || ""),
    originCity: String(raw.originCity || raw.origin || ""),
    destination: String(raw.destination || ""),
    destinationCity: String(raw.destinationCity || raw.destination || ""),
    departTime: String(raw.departTime || ""),
    arriveTime: String(raw.arriveTime || ""),
    duration: String(raw.duration || ""),
    stops: Number(raw.stops || 0),
    price: Math.round(Number(raw.price || 0)),
    currency: String(raw.currency || "INR"),
    cabin: String(raw.cabin || "Economy"),
    seatsLeft: Number(raw.seatsLeft ?? 0),
    refundable: Boolean(raw.refundable),
    aircraft: String(raw.aircraft || ""),
    baggage: String(raw.baggage || ""),
    rating: Number(raw.rating || 0),
  };
}

export function flightLineFromSearchResult(
  item: Record<string, unknown>,
  opts: { travelDate?: string; source?: FlightSource } = {},
): Record<string, unknown> {
  const pub = publicFlightSearchResult(item);
  return {
    source: opts.source || "AMADEUS_API",
    airline: pub.airline,
    flightNumber: pub.flightNumber,
    from: pub.origin,
    to: pub.destination,
    date: opts.travelDate || "",
    depTime: pub.departTime,
    arrTime: pub.arriveTime,
    duration: pub.duration,
    baggage: pub.baggage,
    cabinClass: pub.cabin,
    currency: pub.currency,
    seatsLeft: pub.seatsLeft,
    sellingPrice: pub.price,
    fare: pub.price,
    costPrice: 0,
    remarks: "",
    pnr: "",
  };
}

export function flightLineFromContractedProduct(
  product: Record<string, unknown>,
  opts: { travelDate?: string; rateId?: string; contractedCost?: number; displayPrice?: number | null } = {},
): Record<string, unknown> {
  const selling = Math.round(Number(opts.displayPrice ?? product.adultPrice ?? 0));
  return {
    source: "CONTRACTED_PRODUCT",
    productType: "FLIGHT",
    productId: String(product.id || ""),
    rateId: opts.rateId || undefined,
    airline: String(product.airline || product.name || ""),
    flightNumber: String(product.flightNumber || ""),
    from: String(product.origin || ""),
    to: String(product.destinationAirport || ""),
    date: opts.travelDate || "",
    depTime: String(product.departureTime || ""),
    arrTime: String(product.arrivalTime || ""),
    duration: String(product.duration || ""),
    baggage: String(product.baggage || ""),
    cabinClass: String(product.cabinClass || "Economy"),
    currency: String(product.currency || "INR"),
    costPrice: Math.round(Number(opts.contractedCost ?? 0)),
    sellingPrice: selling || Math.round(Number(opts.contractedCost ?? 0)),
    fare: selling || Math.round(Number(opts.contractedCost ?? 0)),
    remarks: "",
    pnr: "",
  };
}

export function manualFlightTemplate(): Record<string, unknown> {
  return {
    source: "MANUAL",
    airline: "",
    flightNumber: "",
    from: "",
    to: "",
    date: "",
    depTime: "",
    arrTime: "",
    duration: "",
    baggage: "",
    cabinClass: "Economy",
    currency: "INR",
    pnr: "",
    remarks: "",
    costPrice: 0,
    sellingPrice: 0,
    fare: 0,
  };
}

/** Ensure search JSON never echoes credentials or raw provider payloads. */
export function assertNoProviderSecrets(payload: unknown): boolean {
  const text = JSON.stringify(payload || {});
  const banned = ["client_secret", "clientSecret", "flightApiSecret", "apiSecret", "access_token", "Authorization"];
  return !banned.some((k) => text.toLowerCase().includes(k.toLowerCase()));
}
