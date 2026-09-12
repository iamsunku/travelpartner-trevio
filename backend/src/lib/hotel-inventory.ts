/**
 * Phase 13 — Catalogue hotel inventory (HT-04).
 * Uses HotelProduct.inventory / blackoutDates metadata — NOT live supplier GDS availability.
 */

export const CATALOGUE_INVENTORY_UNAVAILABLE =
  "Hotel catalogue inventory is not available for the selected travel dates / rooms.";

export type InventoryCheckSource = "catalogue";

export type InventoryNightStatus =
  | { date: string; status: "ok"; available?: number }
  | { date: string; status: "untracked" }
  | { date: string; status: "sold_out" | "closed" | "insufficient" | "blackout"; available?: number };

export type CatalogueInventoryResult = {
  source: InventoryCheckSource;
  ok: boolean;
  message?: string;
  nights: InventoryNightStatus[];
};

type InventoryRow = {
  roomName: string;
  date: string;
  available: number;
  soldOut: boolean;
  closed: boolean;
};

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value || "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1";
}

export function enumerateStayNights(checkIn: string, checkOut: string): string[] {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || checkOut <= checkIn) return [];
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T12:00:00.000Z`);
  const end = new Date(`${checkOut}T12:00:00.000Z`);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

export function parseHotelInventory(raw: unknown): InventoryRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: InventoryRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = String(row.date || "");
    if (!isIsoDate(date)) continue;
    rows.push({
      roomName: String(row.roomName || "").trim(),
      date,
      available: Math.max(0, Number(row.available || 0)),
      soldOut: parseBool(row.soldOut),
      closed: parseBool(row.closed),
    });
  }
  return rows;
}

export function parseBlackoutRanges(raw: unknown): Array<{ from: string; to: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ from: string; to: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const from = String(row.dateFrom || row.from || "");
    const to = String(row.dateTo || row.to || from);
    if (!isIsoDate(from) || !isIsoDate(to)) continue;
    out.push({ from, to: to < from ? from : to });
  }
  return out;
}

function inBlackout(date: string, ranges: Array<{ from: string; to: string }>): boolean {
  return ranges.some((r) => date >= r.from && date <= r.to);
}

function roomMatches(rowRoom: string, requested: string): boolean {
  if (!requested) return true;
  if (!rowRoom) return true;
  return rowRoom.toLowerCase() === requested.toLowerCase();
}

/**
 * Catalogue availability for a stay. Empty inventory ⇒ untracked nights (no catalogue block).
 * Does not claim real-time supplier confirmation and does not hold/decrement stock.
 */
export function checkCatalogueHotelInventory(input: {
  inventory?: unknown;
  blackoutDates?: unknown;
  checkIn?: string | null;
  checkOut?: string | null;
  roomType?: string | null;
  rooms?: number | null;
}): CatalogueInventoryResult {
  const rooms = Math.max(1, Math.round(Number(input.rooms || 1)));
  const roomType = String(input.roomType || "").trim();
  const checkIn = input.checkIn && isIsoDate(input.checkIn) ? input.checkIn : null;
  const checkOut = input.checkOut && isIsoDate(input.checkOut) ? input.checkOut : null;

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return {
      source: "catalogue",
      ok: false,
      message: "Valid hotel check-in and check-out dates are required for catalogue inventory.",
      nights: [],
    };
  }

  const nights = enumerateStayNights(checkIn, checkOut);
  if (!nights.length) {
    return { source: "catalogue", ok: false, message: "Stay must include at least one night.", nights: [] };
  }

  const inventory = parseHotelInventory(input.inventory);
  const blackouts = parseBlackoutRanges(input.blackoutDates);
  const nightStatuses: InventoryNightStatus[] = [];

  for (const date of nights) {
    if (inBlackout(date, blackouts)) {
      nightStatuses.push({ date, status: "blackout" });
      continue;
    }
    const matches = inventory.filter((r) => r.date === date && roomMatches(r.roomName, roomType));
    if (!matches.length) {
      nightStatuses.push({ date, status: "untracked" });
      continue;
    }
    // Prefer exact room match; otherwise any matching rows.
    const exact = matches.filter((r) => r.roomName && roomMatches(r.roomName, roomType));
    const pool = exact.length ? exact : matches;
    if (pool.some((r) => r.closed)) {
      nightStatuses.push({ date, status: "closed" });
      continue;
    }
    if (pool.some((r) => r.soldOut)) {
      nightStatuses.push({ date, status: "sold_out" });
      continue;
    }
    const available = Math.min(...pool.map((r) => r.available));
    if (available < rooms) {
      nightStatuses.push({ date, status: "insufficient", available });
      continue;
    }
    nightStatuses.push({ date, status: "ok", available });
  }

  const blocked = nightStatuses.find((n) => n.status !== "ok" && n.status !== "untracked");
  if (blocked) {
    return {
      source: "catalogue",
      ok: false,
      message: CATALOGUE_INVENTORY_UNAVAILABLE,
      nights: nightStatuses,
    };
  }
  return { source: "catalogue", ok: true, nights: nightStatuses };
}

/** Manual / self-booked hotels skip catalogue inventory enforcement. */
export function hotelLineRequiresCatalogueInventory(line: Record<string, unknown>): boolean {
  const source = String(line.source || "");
  if (source === "MANUAL" || source === "AMADEUS_API" || source === "API") return false;
  return Boolean(line.productId) && (line.productType === "HOTEL" || !line.productType);
}
