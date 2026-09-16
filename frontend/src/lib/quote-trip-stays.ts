/** Frontend mirror of backend trip-city stay windows (Module 02A). */

export type QuoteTripCity = {
  city: string;
  nights: number;
  order: number;
  destinationId?: string | null;
};

export type TripCityStayWindow = {
  city: string;
  nights: number;
  order: number;
  destinationId?: string | null;
  checkIn: string;
  checkOut: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDaysYmd(ymd: string, days: number): string {
  if (!ISO_DATE.test(ymd) || !Number.isFinite(days)) return "";
  const dt = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildTripCityStayWindows(
  cities: Array<{ city?: string; nights?: number; order?: number; destinationId?: string | null }>,
  travelStartDate: string,
): TripCityStayWindow[] {
  if (!ISO_DATE.test(travelStartDate)) return [];
  const normalized = cities
    .map((row, i) => ({
      city: String(row.city || "").trim(),
      nights: Math.max(0, Math.round(Number(row.nights) || 0)),
      order: Number(row.order) > 0 ? Math.round(Number(row.order)) : i + 1,
      destinationId: row.destinationId ?? null,
    }))
    .filter((r) => r.city && r.nights > 0)
    .sort((a, b) => a.order - b.order)
    .map((r, i) => ({ ...r, order: i + 1 }));

  let cursor = travelStartDate;
  const out: TripCityStayWindow[] = [];
  for (const row of normalized) {
    const checkIn = cursor;
    const checkOut = addDaysYmd(checkIn, row.nights);
    if (!checkOut) break;
    out.push({
      city: row.city,
      nights: row.nights,
      order: row.order,
      destinationId: row.destinationId,
      checkIn,
      checkOut,
    });
    cursor = checkOut;
  }
  return out;
}

function cityKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function findStayWindowForCity(
  windows: TripCityStayWindow[],
  city: string,
): TripCityStayWindow | undefined {
  const key = cityKey(city);
  if (!key) return undefined;
  return windows.find((w) => cityKey(w.city) === key);
}

/** Encode for GET /api/products/hotels?cityStayDates=Phuket:2026-10-18,Krabi:2026-10-21 */
export function encodeCityStayDates(windows: TripCityStayWindow[]): string {
  return windows.map((w) => `${w.city}:${w.checkIn}`).join(",");
}

export function syncHotelRowsToTripStays(
  hotels: Record<string, unknown>[],
  windows: TripCityStayWindow[],
): Record<string, unknown>[] {
  return hotels.map((line) => {
    if (line.stayDatesLocked === true) return line;
    const key = cityKey(line.tripCity) || cityKey(line.city);
    if (!key) return line;
    const win = windows.find((w) => cityKey(w.city) === key);
    if (!win) return line;
    return {
      ...line,
      tripCity: win.city,
      city: win.city,
      checkIn: win.checkIn,
      checkOut: win.checkOut,
      nights: win.nights,
    };
  });
}

export type HotelTransferLocation = {
  lineId: string;
  hotelName: string;
  address: string;
  city: string;
  /** Operational pickup/drop value (address preferred; else name + city). */
  location: string;
  label: string;
  selfBooked: boolean;
};

/**
 * Operational hotel endpoints for transfer pickup/drop.
 * Includes catalogue and self-booked hotels. Does not invent addresses.
 * Uses address when present; otherwise hotel name (+ city) as the best available location.
 */
export function hotelTransferLocations(hotels: unknown): HotelTransferLocation[] {
  if (!Array.isArray(hotels)) return [];
  const out: HotelTransferLocation[] = [];
  hotels.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const line = raw as Record<string, unknown>;
    const hotelName = String(line.hotelName || line.name || "").trim();
    const city = String(line.tripCity || line.city || "").trim();
    const address = String(line.address || line.location || "").trim();
    const location = address
      || (hotelName && city ? `${hotelName}, ${city}` : "")
      || hotelName
      || city;
    if (!location) return;
    const selfBooked = line.selfBooked === true || String(line.source || "") === "MANUAL";
    const lineId = String(line.lineId || line.id || `hotel-${index}`);
    const label = address
      ? (city ? `${hotelName || "Hotel"} (${city}) — ${address}` : `${hotelName || "Hotel"} — ${address}`)
      : (city && hotelName ? `${hotelName} (${city})` : location);
    out.push({
      lineId,
      hotelName: hotelName || (selfBooked ? "Self-booked hotel" : "Hotel"),
      address,
      city,
      location,
      label,
      selfBooked,
    });
  });
  return out;
}

/** @deprecated Prefer hotelTransferLocations — kept for older call sites. */
export function selfBookedHotelTransferLocations(hotels: unknown): HotelTransferLocation[] {
  return hotelTransferLocations(hotels).filter((l) => l.selfBooked && Boolean(l.address));
}
