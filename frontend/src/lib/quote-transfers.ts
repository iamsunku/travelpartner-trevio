/** Multi-city transfer helpers for Quotation Wizard (Module 05A). */

import type { TripCityStayWindow } from "./quote-trip-stays";
import { hotelTransferLocations, type HotelTransferLocation } from "./quote-trip-stays";

export type AutoTransferSuggestion = {
  autoKey: string;
  transferType: string;
  date: string;
  pickup: string;
  drop: string;
  city: string;
  source: "AUTO";
  selfBooked: false;
  vehicleType: string;
  pax?: number;
  currency?: string;
};

function citySlug(city: string): string {
  return String(city || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "CITY";
}

function hotelForCity(
  locations: HotelTransferLocation[],
  city: string,
): HotelTransferLocation | undefined {
  const key = city.trim().toLowerCase();
  if (!key) return undefined;
  return locations.find((l) => l.city.trim().toLowerCase() === key) || undefined;
}

/**
 * Safe operational transfer suggestions from trip stay windows + hotels.
 * Does not invent prices, airport codes, or addresses.
 * Airport endpoints are left blank when no airport data exists.
 */
export function suggestAutoTransfers(opts: {
  stayWindows: TripCityStayWindow[];
  hotels: unknown;
  pax?: number;
  currency?: string;
}): AutoTransferSuggestion[] {
  const windows = [...(opts.stayWindows || [])].sort((a, b) => a.order - b.order);
  if (!windows.length) return [];

  const locations = hotelTransferLocations(opts.hotels);
  const out: AutoTransferSuggestion[] = [];
  const meta = {
    pax: opts.pax != null && Number.isFinite(opts.pax) ? Math.max(1, Math.round(opts.pax)) : undefined,
    currency: opts.currency ? String(opts.currency) : undefined,
  };

  const first = windows[0];
  const firstHotel = hotelForCity(locations, first.city);
  if (firstHotel) {
    out.push({
      autoKey: "AUTO_ARRIVAL",
      transferType: "Airport Pickup",
      date: first.checkIn,
      pickup: "",
      drop: firstHotel.location,
      city: first.city,
      source: "AUTO",
      selfBooked: false,
      vehicleType: "Sedan",
      ...meta,
    });
  }

  for (let i = 0; i < windows.length - 1; i++) {
    const from = windows[i];
    const to = windows[i + 1];
    const fromHotel = hotelForCity(locations, from.city);
    const toHotel = hotelForCity(locations, to.city);
    if (!fromHotel || !toHotel) continue;
    out.push({
      autoKey: `AUTO_CITY_TRANSFER_${citySlug(from.city)}_${citySlug(to.city)}`,
      transferType: "Intercity Transfer",
      date: to.checkIn,
      pickup: fromHotel.location,
      drop: toHotel.location,
      city: to.city,
      source: "AUTO",
      selfBooked: false,
      vehicleType: "Sedan",
      ...meta,
    });
  }

  const last = windows[windows.length - 1];
  const lastHotel = hotelForCity(locations, last.city);
  if (lastHotel) {
    out.push({
      autoKey: "AUTO_DEPARTURE",
      transferType: "Airport Drop",
      date: last.checkOut,
      pickup: lastHotel.location,
      drop: "",
      city: last.city,
      source: "AUTO",
      selfBooked: false,
      vehicleType: "Sedan",
      ...meta,
    });
  }

  return out;
}

function transferFingerprint(row: Record<string, unknown>): string {
  return [
    String(row.date || ""),
    String(row.pickup || "").trim().toLowerCase(),
    String(row.drop || "").trim().toLowerCase(),
    String(row.transferType || "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Merge auto suggestions into existing transfer rows without duplicating
 * by autoKey or by date+pickup+drop+type. Never deletes manual rows.
 */
export function mergeAutoTransfers(
  existing: Record<string, unknown>[],
  suggestions: AutoTransferSuggestion[],
): Record<string, unknown>[] {
  const rows = [...existing];
  const keys = new Set(
    rows.map((r) => String(r.autoKey || "")).filter(Boolean),
  );
  const prints = new Set(rows.map(transferFingerprint));

  for (const s of suggestions) {
    if (keys.has(s.autoKey)) continue;
    const next: Record<string, unknown> = {
      ...s,
      costPrice: undefined,
      sellingPrice: undefined,
      remarks: "",
      voucher: "",
      pickupTime: "",
      duration: "",
      supplier: "",
    };
    delete next.costPrice;
    delete next.sellingPrice;
    const fp = transferFingerprint(next);
    if (prints.has(fp)) continue;
    keys.add(s.autoKey);
    prints.add(fp);
    rows.push(next);
  }
  return rows;
}

/** Default activity date within a city stay — prefers a mid-stay day when nights > 1. */
export function defaultActivityDateForCity(
  windows: TripCityStayWindow[],
  city: string,
): string {
  const key = city.trim().toLowerCase();
  if (!key) return "";
  const win = windows.find((w) => w.city.trim().toLowerCase() === key);
  if (!win) return "";
  if (win.nights <= 1) return win.checkIn;
  // Prefer day after check-in when available (sightseeing day), else check-in.
  const midOffset = Math.min(1, win.nights - 1);
  const y = win.checkIn.slice(0, 4);
  const m = win.checkIn.slice(5, 7);
  const d = win.checkIn.slice(8, 10);
  const dt = new Date(`${y}-${m}-${d}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return win.checkIn;
  dt.setDate(dt.getDate() + midOffset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isDateInCityStay(
  windows: TripCityStayWindow[],
  city: string,
  date: string,
): boolean {
  const key = city.trim().toLowerCase();
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
  const win = windows.find((w) => w.city.trim().toLowerCase() === key);
  if (!win) return true;
  return date >= win.checkIn && date < win.checkOut;
}
