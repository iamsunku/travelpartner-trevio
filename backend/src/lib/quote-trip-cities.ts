/** Normalize Trip Plan City Wise rows for Quotation.tripCities JSON. */

export type QuoteTripCity = {
  city: string;
  nights: number;
  order: number;
  destinationId?: string | null;
};

/** City-segmented stay window derived from travel start + Trip Plan City Wise order. */
export type TripCityStayWindow = {
  city: string;
  nights: number;
  order: number;
  destinationId?: string | null;
  /** Inclusive check-in (YYYY-MM-DD). */
  checkIn: string;
  /** Exclusive check-out / next city check-in (YYYY-MM-DD). */
  checkOut: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTripCities(raw: unknown): QuoteTripCity[] {
  if (!Array.isArray(raw)) return [];
  const out: QuoteTripCity[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const r = row as Record<string, unknown>;
    const city = String(r.city ?? "").trim();
    const nights = Math.max(0, Math.round(Number(r.nights) || 0));
    if (!city || nights <= 0) return;
    const orderRaw = Number(r.order);
    out.push({
      city,
      nights,
      order: Number.isFinite(orderRaw) && orderRaw > 0 ? Math.round(orderRaw) : i + 1,
      destinationId: r.destinationId != null && String(r.destinationId).trim()
        ? String(r.destinationId).trim()
        : null,
    });
  });
  return out
    .sort((a, b) => a.order - b.order)
    .map((row, i) => ({ ...row, order: i + 1 }));
}

export function tripCitiesTotalNights(cities: QuoteTripCity[]): number {
  return cities.reduce((sum, c) => sum + Math.max(0, c.nights), 0);
}

export function tripCitiesDestinationLabel(cities: QuoteTripCity[]): string {
  return cities.map((c) => c.city).filter(Boolean).join(" · ");
}

/** Add calendar days to YYYY-MM-DD without UTC day-shift (noon local). */
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

/**
 * Build sequential stay windows from Trip Plan City Wise.
 * Example: start 2026-10-18, Phuket 3 + Krabi 2 →
 *   Phuket 18→21 (3n), Krabi 21→23 (2n).
 */
export function buildTripCityStayWindows(
  cities: QuoteTripCity[],
  travelStartDate: string,
): TripCityStayWindow[] {
  if (!ISO_DATE.test(travelStartDate)) return [];
  const normalized = normalizeTripCities(cities);
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
      destinationId: row.destinationId ?? null,
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

/**
 * Recalculate hotel line stay dates from trip-city windows.
 * Hotels with stayDatesLocked=true keep their checkIn/checkOut.
 * Association: tripCity (preferred) then city string match.
 */
export function syncHotelRowsToTripStays(
  hotels: unknown,
  windows: TripCityStayWindow[],
): Record<string, unknown>[] {
  if (!Array.isArray(hotels)) return [];
  return hotels.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw as Record<string, unknown>;
    const line = { ...(raw as Record<string, unknown>) };
    if (line.stayDatesLocked === true) return line;
    const key = cityKey(line.tripCity) || cityKey(line.city);
    if (!key) return line;
    const win = windows.find((w) => cityKey(w.city) === key);
    if (!win) return line;
    line.tripCity = win.city;
    line.city = win.city;
    line.checkIn = win.checkIn;
    line.checkOut = win.checkOut;
    line.nights = win.nights;
    return line;
  });
}

/** Self-booked / operational hotel lines that expose an address for transfer pickup/drop. */
export function selfBookedHotelTransferLocations(hotels: unknown): Array<{
  lineId: string;
  hotelName: string;
  address: string;
  city: string;
  label: string;
}> {
  if (!Array.isArray(hotels)) return [];
  const out: Array<{ lineId: string; hotelName: string; address: string; city: string; label: string }> = [];
  hotels.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const line = raw as Record<string, unknown>;
    const selfBooked = line.selfBooked === true || String(line.source || "") === "MANUAL";
    if (!selfBooked) return;
    const address = String(line.address || line.location || "").trim();
    if (!address) return;
    const hotelName = String(line.hotelName || line.name || "Self-booked hotel").trim();
    const city = String(line.tripCity || line.city || "").trim();
    const lineId = String(line.lineId || line.id || `hotel-${index}`);
    out.push({
      lineId,
      hotelName,
      address,
      city,
      label: city ? `${hotelName} (${city}) — ${address}` : `${hotelName} — ${address}`,
    });
  });
  return out;
}
