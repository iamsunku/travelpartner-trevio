/**
 * Map search / catalogue / manual inputs onto quotation flight lines
 * without inventing a second pricing engine. Pricing remains Phase 3.
 */

export type FlightSource = "AMADEUS_API" | "MOCK" | "MANUAL" | "CONTRACTED_PRODUCT";

/** Customer-safe search result fields (never includes provider credentials). */
export function publicFlightSearchResult(raw: Record<string, unknown>) {
  const departDate = String(raw.departDate || raw.departureDate || raw.date || "");
  const arriveDate = String(raw.arriveDate || raw.arrivalDate || "");
  return {
    id: String(raw.id || ""),
    airline: String(raw.airline || ""),
    airlineCode: String(raw.airlineCode || ""),
    flightNumber: String(raw.flightNumber || ""),
    origin: String(raw.origin || ""),
    originCity: String(raw.originCity || raw.origin || ""),
    destination: String(raw.destination || ""),
    destinationCity: String(raw.destinationCity || raw.destination || ""),
    departDate,
    arriveDate: arriveDate || undefined,
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
    direction: raw.direction ? String(raw.direction) : undefined,
    segmentIndex: raw.segmentIndex != null ? Number(raw.segmentIndex) : undefined,
    journeyId: raw.journeyId ? String(raw.journeyId) : undefined,
  };
}

export function flightLineFromSearchResult(
  item: Record<string, unknown>,
  opts: {
    travelDate?: string;
    source?: FlightSource;
    adults?: number;
    children?: number;
    infants?: number;
    segmentIndex?: number;
    journeyId?: string;
  } = {},
): Record<string, unknown> {
  const pub = publicFlightSearchResult(item);
  const source: FlightSource = opts.source || (String(item.source || "") === "MOCK" ? "MOCK" : "AMADEUS_API");
  const date = pub.departDate || opts.travelDate || "";
  const arrivalDate = pub.arriveDate || undefined;
  return {
    source,
    provider: source,
    airline: pub.airline,
    airlineCode: pub.airlineCode,
    flightNumber: pub.flightNumber,
    from: pub.origin,
    to: pub.destination,
    date,
    arrivalDate: arrivalDate || "",
    depTime: pub.departTime,
    arrTime: pub.arriveTime,
    duration: pub.duration,
    stops: pub.stops,
    baggage: pub.baggage,
    cabinClass: pub.cabin,
    currency: pub.currency,
    seatsLeft: pub.seatsLeft,
    refundable: pub.refundable,
    aircraft: pub.aircraft,
    sellingPrice: pub.price,
    fare: pub.price,
    // No invented internal cost for API/mock fares — commercial amount is fare/selling.
    remarks: "",
    pnr: "",
    flightDocuments: [],
    direction: pub.direction,
    segmentIndex: opts.segmentIndex ?? pub.segmentIndex ?? 0,
    journeyId: opts.journeyId || pub.journeyId || pub.id || undefined,
    adults: opts.adults != null ? Math.max(0, Math.round(opts.adults)) : undefined,
    children: opts.children != null ? Math.max(0, Math.round(opts.children)) : undefined,
    infants: opts.infants != null ? Math.max(0, Math.round(opts.infants)) : undefined,
  };
}

export function flightLineFromContractedProduct(
  product: Record<string, unknown>,
  opts: {
    travelDate?: string;
    rateId?: string;
    contractedCost?: number;
    displayPrice?: number | null;
    adults?: number;
    children?: number;
    infants?: number;
    segmentIndex?: number;
  } = {},
): Record<string, unknown> {
  const selling = Math.round(Number(opts.displayPrice ?? product.adultPrice ?? 0));
  const cost = Math.round(Number(opts.contractedCost ?? 0));
  return {
    source: "CONTRACTED_PRODUCT",
    productType: "FLIGHT",
    productId: String(product.id || ""),
    rateId: opts.rateId || undefined,
    airline: String(product.airline || product.name || ""),
    airlineCode: String(product.airlineCode || ""),
    flightNumber: String(product.flightNumber || ""),
    from: String(product.origin || ""),
    to: String(product.destinationAirport || ""),
    // Do not invent segment date from trip start — caller supplies intended date or leaves blank.
    date: opts.travelDate || "",
    arrivalDate: String(product.arrivalDate || ""),
    depTime: String(product.departureTime || ""),
    arrTime: String(product.arrivalTime || ""),
    duration: String(product.duration || ""),
    stops: Number(product.stops || 0),
    baggage: String(product.baggage || ""),
    cabinClass: String(product.cabinClass || "Economy"),
    currency: String(product.currency || "INR"),
    costPrice: cost,
    sellingPrice: selling || cost,
    fare: selling || cost,
    remarks: "",
    pnr: "",
    flightDocuments: [],
    segmentIndex: opts.segmentIndex ?? 0,
    adults: opts.adults != null ? Math.max(0, Math.round(opts.adults)) : undefined,
    children: opts.children != null ? Math.max(0, Math.round(opts.children)) : undefined,
    infants: opts.infants != null ? Math.max(0, Math.round(opts.infants)) : undefined,
  };
}

/** Self-booked / manual template — no invented commercial amounts. */
export function manualFlightTemplate(opts: {
  currency?: string;
  from?: string;
  cabinClass?: string;
  adults?: number;
  children?: number;
  infants?: number;
} = {}): Record<string, unknown> {
  return {
    source: "MANUAL",
    selfBooked: true,
    airline: "",
    airlineCode: "",
    flightNumber: "",
    from: opts.from || "",
    to: "",
    date: "",
    arrivalDate: "",
    depTime: "",
    arrTime: "",
    duration: "",
    stops: 0,
    baggage: "",
    cabinClass: opts.cabinClass || "Economy",
    currency: opts.currency || "INR",
    pnr: "",
    remarks: "",
    flightDocuments: [],
    segmentIndex: 0,
    adults: opts.adults != null ? opts.adults : undefined,
    children: opts.children != null ? opts.children : undefined,
    infants: opts.infants != null ? opts.infants : undefined,
    // Intentionally omit costPrice / sellingPrice / fare so pricing treats as unset self-booked.
  };
}

/** Ensure search JSON never echoes credentials or raw provider payloads. */
export function assertNoProviderSecrets(payload: unknown): boolean {
  const text = JSON.stringify(payload || {});
  const banned = ["client_secret", "clientSecret", "flightApiSecret", "apiSecret", "access_token", "Authorization"];
  return !banned.some((k) => text.toLowerCase().includes(k.toLowerCase()));
}
