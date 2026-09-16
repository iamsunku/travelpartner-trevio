import { logger } from "./logger.js";
import type { Flight, Hotel } from "./types.js";

const AMADEUS_TEST = "https://test.api.amadeus.com";
const AMADEUS_PROD = "https://api.amadeus.com";

type TokenCache = { token: string; expiresAt: number; key: string };
const tokenCache = new Map<string, TokenCache>();

function amadeusHost(clientId: string): string {
  // Live Amadeus client ids typically do not use the test host.
  // Prefer test host unless explicitly forced live.
  if (process.env.AMADEUS_HOST === "production") return AMADEUS_PROD;
  if (process.env.AMADEUS_HOST === "test") return AMADEUS_TEST;
  if (/^live/i.test(clientId) || process.env.AMADEUS_ENV === "production") return AMADEUS_PROD;
  return AMADEUS_TEST;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const cacheKey = clientId;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const host = amadeusHost(clientId);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${host}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus auth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || 1799) * 1000,
    key: cacheKey,
  });
  return json.access_token;
}

function cabinFromAmadeus(code?: string): Flight["cabin"] {
  const c = (code || "ECONOMY").toUpperCase();
  if (c.includes("FIRST")) return "First";
  if (c.includes("BUSINESS")) return "Business";
  if (c.includes("PREMIUM")) return "Premium Economy";
  return "Economy";
}

function formatDuration(iso?: string): string {
  if (!iso) return "—";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return iso;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  return `${h}h ${min}m`;
}

function timeFromIso(iso?: string): string {
  if (!iso) return "00:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || "00:00";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Common city / airport name → IATA city or airport code */
const CITY_CODES: Record<string, string> = {
  mumbai: "BOM", bombay: "BOM", bom: "BOM",
  delhi: "DEL", "new delhi": "DEL", del: "DEL",
  bangalore: "BLR", bengaluru: "BLR", blr: "BLR",
  hyderabad: "HYD", hyd: "HYD",
  chennai: "MAA", madras: "MAA", maa: "MAA",
  kolkata: "CCU", calcutta: "CCU", ccu: "CCU",
  goa: "GOI", goi: "GOI",
  pune: "PNQ", pnq: "PNQ",
  jaipur: "JAI", jai: "JAI",
  ahmedabad: "AMD", amd: "AMD",
  kochi: "COK", cochin: "COK", cok: "COK",
  dubai: "DXB", dxb: "DXB",
  singapore: "SIN", sin: "SIN",
  bangkok: "BKK", bkk: "BKK",
  phuket: "HKT", hkt: "HKT",
  london: "LON", lon: "LON", lhr: "LHR",
  paris: "PAR", par: "PAR",
  "new york": "NYC", nyc: "NYC",
  dubaiu: "DXB",
};

export function resolveIataCode(input: string): string {
  const raw = String(input || "").trim();
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const hit = CITY_CODES[raw.toLowerCase()];
  if (hit) return hit;
  // last resort: first 3 letters (often wrong — callers should prefer codes)
  return raw.slice(0, 3).toUpperCase();
}

function dateFromIso(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return iso.slice(0, 10) || "";
}

function travelClassParam(cabin?: string): string | undefined {
  const c = String(cabin || "").toUpperCase().replace(/\s+/g, "_");
  if (!c) return undefined;
  if (c.includes("FIRST")) return "FIRST";
  if (c.includes("BUSINESS")) return "BUSINESS";
  if (c.includes("PREMIUM")) return "PREMIUM_ECONOMY";
  if (c.includes("ECONOMY")) return "ECONOMY";
  return undefined;
}

function mapItineraryLeg(opts: {
  offer: Record<string, unknown>;
  itin: Record<string, unknown>;
  offerIndex: number;
  legIndex: number;
  carriers: Record<string, string>;
  aircraftDict: Record<string, string>;
  fallbackOrigin: string;
  fallbackDestination: string;
  direction: Flight["direction"];
  priceShare: number;
  currency: string;
}): Flight {
  const segments = (opts.itin.segments as Array<Record<string, unknown>>) || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const dep = first.departure as { iataCode?: string; at?: string } | undefined;
  const arr = last.arrival as { iataCode?: string; at?: string } | undefined;
  const carrier = String(first.carrierCode || "");
  const traveler = ((opts.offer.travelerPricings as Array<Record<string, unknown>>) || [])[0];
  const fareDetails = ((traveler?.fareDetailsBySegment as Array<Record<string, unknown>>) || [])[0];
  const cabin = cabinFromAmadeus(String(fareDetails?.cabin || ""));
  const aircraftCode = String((first.aircraft as { code?: string } | undefined)?.code || "");
  const bags = fareDetails?.includedCheckedBags as { quantity?: number; weight?: number; weightUnit?: string } | undefined;
  let baggage = "";
  if (bags?.quantity != null && bags.quantity > 0) {
    baggage = bags.weight
      ? `${bags.quantity} × ${bags.weight}${bags.weightUnit || "kg"}`
      : `${bags.quantity} checked bag(s)`;
  }
  const journeyId = String(opts.offer.id || `amadeus-fl-${opts.offerIndex + 1}`);
  return {
    id: `${journeyId}-${opts.legIndex}`,
    airline: opts.carriers[carrier] || carrier || "Airline",
    airlineCode: carrier || "XX",
    flightNumber: `${carrier}${first.number || opts.offerIndex + 100}`,
    origin: dep?.iataCode || opts.fallbackOrigin,
    originCity: dep?.iataCode || opts.fallbackOrigin,
    destination: arr?.iataCode || opts.fallbackDestination,
    destinationCity: arr?.iataCode || opts.fallbackDestination,
    departDate: dateFromIso(dep?.at),
    arrivalDate: dateFromIso(arr?.at),
    departTime: timeFromIso(dep?.at),
    arriveTime: timeFromIso(arr?.at),
    duration: formatDuration(String(opts.itin.duration || "")),
    stops: Math.max(0, segments.length - 1),
    price: opts.priceShare,
    currency: opts.currency,
    cabin,
    seatsLeft: Number(opts.offer.numberOfBookableSeats || 9),
    refundable: false,
    aircraft: opts.aircraftDict[aircraftCode] || aircraftCode || "—",
    baggage,
    rating: 4.2,
    direction: opts.direction,
    segmentIndex: opts.legIndex,
    journeyId,
  } satisfies Flight;
}

export async function searchAmadeusFlights(opts: {
  clientId: string;
  clientSecret: string;
  origin: string;
  destination: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  cabinClass?: string;
  max?: number;
}): Promise<Flight[]> {
  const token = await getAccessToken(opts.clientId, opts.clientSecret);
  const host = amadeusHost(opts.clientId);
  const origin = resolveIataCode(opts.origin);
  const destination = resolveIataCode(opts.destination);
  const departureDate =
    opts.departureDate ||
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const adults = Math.max(1, Number(opts.adults || 1));
  const children = Math.max(0, Number(opts.children || 0));
  const infants = Math.max(0, Number(opts.infants || 0));
  const max = Math.min(Math.max(1, Number(opts.max || 8)), 20);

  const qs = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate,
    adults: String(adults),
    currencyCode: "INR",
    max: String(max),
  });
  if (opts.returnDate) qs.set("returnDate", opts.returnDate);
  if (children > 0) qs.set("children", String(children));
  if (infants > 0) qs.set("infants", String(infants));
  const travelClass = travelClassParam(opts.cabinClass);
  if (travelClass) qs.set("travelClass", travelClass);

  const res = await fetch(`${host}/v2/shopping/flight-offers?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus flight search failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    data?: Array<Record<string, unknown>>;
    dictionaries?: { carriers?: Record<string, string>; aircraft?: Record<string, string> };
  };
  const carriers = json.dictionaries?.carriers || {};
  const aircraftDict = json.dictionaries?.aircraft || {};
  const out: Flight[] = [];

  (json.data || []).forEach((offer, i) => {
    const itineraries = (offer.itineraries as Array<Record<string, unknown>>) || [];
    const priceObj = offer.price as { total?: string; currency?: string } | undefined;
    const totalPrice = Math.round(Number(priceObj?.total || 0));
    const currency = String(priceObj?.currency || "INR");
    const legCount = Math.max(1, itineraries.length);
    const priceShare = Math.round(totalPrice / legCount);

    itineraries.forEach((itin, legIndex) => {
      const direction: Flight["direction"] =
        legCount > 1 ? (legIndex === 0 ? "outbound" : "return") : "outbound";
      out.push(mapItineraryLeg({
        offer,
        itin,
        offerIndex: i,
        legIndex,
        carriers,
        aircraftDict,
        fallbackOrigin: legIndex === 0 ? origin : destination,
        fallbackDestination: legIndex === 0 ? destination : origin,
        direction,
        priceShare,
        currency,
      }));
    });
  });

  return out;
}

export async function searchAmadeusHotels(opts: {
  clientId: string;
  clientSecret: string;
  city: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  max?: number;
}): Promise<Hotel[]> {
  const token = await getAccessToken(opts.clientId, opts.clientSecret);
  const host = amadeusHost(opts.clientId);
  const cityCode = resolveIataCode(opts.city);
  const max = Math.min(Math.max(1, Number(opts.max || 8)), 20);
  const adults = Math.max(1, Number(opts.adults || 2));
  const checkIn =
    opts.checkIn || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const checkOut =
    opts.checkOut ||
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  const listRes = await fetch(
    `${host}/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(cityCode)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Amadeus hotel list failed (${listRes.status}): ${text.slice(0, 240)}`);
  }
  const listJson = (await listRes.json()) as {
    data?: Array<{ hotelId?: string; name?: string; geoCode?: { latitude?: number; longitude?: number }; address?: { lines?: string[]; cityName?: string } }>;
  };
  const hotelsMeta = (listJson.data || []).slice(0, max);
  if (!hotelsMeta.length) return [];

  const hotelIds = hotelsMeta.map((h) => h.hotelId).filter(Boolean).join(",");
  const offersQs = new URLSearchParams({
    hotelIds,
    adults: String(adults),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    currency: "INR",
    bestRateOnly: "true",
  });

  let offersByHotel = new Map<string, { price: number; currency: string; room?: string; description?: string }>();
  try {
    const offerRes = await fetch(`${host}/v3/shopping/hotel-offers?${offersQs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (offerRes.ok) {
      const offerJson = (await offerRes.json()) as {
        data?: Array<{
          hotel?: { hotelId?: string };
          offers?: Array<{
            price?: { total?: string; currency?: string };
            room?: { typeEstimated?: { category?: string }; description?: { text?: string } };
          }>;
        }>;
      };
      for (const row of offerJson.data || []) {
        const id = row.hotel?.hotelId;
        const offer = row.offers?.[0];
        if (!id || !offer) continue;
        offersByHotel.set(id, {
          price: Math.round(Number(offer.price?.total || 0)),
          currency: String(offer.price?.currency || "INR"),
          room: offer.room?.typeEstimated?.category || "Room",
          description: offer.room?.description?.text || "Standard room",
        });
      }
    } else {
      logger.warn(`Amadeus hotel offers soft-fail: ${offerRes.status}`);
    }
  } catch (e) {
    logger.warn(`Amadeus hotel offers error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return hotelsMeta.map((h, i) => {
    const id = String(h.hotelId || `amadeus-ht-${i + 1}`);
    const offer = offersByHotel.get(id);
    const price = offer?.price || 4500 + (i % 5) * 800;
    const currency = offer?.currency || "INR";
    const area = h.address?.lines?.[0] || h.address?.cityName || cityCode;
    return {
      id,
      name: h.name || `Hotel ${cityCode}`,
      city: h.address?.cityName || opts.city,
      area,
      starRating: 3 + (i % 3),
      rating: 4.0 + (i % 8) / 10,
      reviews: 50 + i * 17,
      pricePerNight: price,
      currency,
      originalPrice: Math.round(price * 1.12),
      amenities: ["Free WiFi", "Breakfast available", "Front desk"],
      images: [],
      distanceFromCenter: 1 + (i % 7),
      latitude: h.geoCode?.latitude || 0,
      longitude: h.geoCode?.longitude || 0,
      rooms: [
        {
          id: `${id}-r1`,
          name: offer?.room || "Standard Room",
          description: offer?.description || "As per supplier",
          price,
          maxGuests: adults,
          beds: "As per hotel",
          includesBreakfast: true,
          freeCancellation: false,
          refundable: false,
          roomsLeft: 3,
        },
      ],
    } satisfies Hotel;
  });
}
