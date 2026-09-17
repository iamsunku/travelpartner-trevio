/**
 * MODULE 04A — Safe multi-service itinerary synchronization.
 * Preserves manual days/items; refreshes only AUTO-tagged content.
 */

import { addDaysYmd, type TripCityStayWindow } from "./quote-trip-stays";

export type ItineraryItemType = "FLIGHT" | "HOTEL" | "TRANSFER" | "ACTIVITY" | "MEAL" | "MANUAL";

const AUTO_FLAGS = [
  "autoFromHotel",
  "autoFromFlight",
  "autoFromTransfer",
  "autoFromActivity",
  "autoFromMeal",
] as const;

const TYPE_ORDER: Record<string, number> = {
  FLIGHT: 10,
  TRANSFER: 20,
  HOTEL: 30,
  MEAL: 40,
  ACTIVITY: 50,
  MANUAL: 60,
};

export type ItinerarySyncInput = {
  hotels?: Record<string, unknown>[];
  flights?: Record<string, unknown>[];
  transfers?: Record<string, unknown>[];
  activities?: Record<string, unknown>[];
  meals?: Record<string, unknown>[];
  stayWindows?: TripCityStayWindow[];
  travelStartDate?: string;
};

function asDay(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asItems(day: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(day.items) ? (day.items as Record<string, unknown>[]) : [];
}

function isAutoItem(item: Record<string, unknown>): boolean {
  return AUTO_FLAGS.some((k) => item[k] === true);
}

function isManualDay(day: Record<string, unknown>): boolean {
  if (day.manualDay === true) return true;
  if (day.autoSkeleton === true || day.autoFromHotel === true || day.autoFromFlightDay === true) return false;
  // Legacy / user-added day without auto markers
  const items = asItems(day);
  if (!items.length) return true;
  return items.every((i) => !isAutoItem(i));
}

export function lineKey(row: Record<string, unknown>, prefix: string, index: number): string {
  if (row.lineId) return String(row.lineId);
  if (row.id) return String(row.id);
  return `${prefix}-${index}`;
}

export function formatItineraryDate(ymd: string): string {
  const raw = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function stayNights(checkIn?: string, checkOut?: string): number | null {
  const a = String(checkIn || "");
  const b = String(checkOut || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b <= a) return null;
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function mergePreserved(
  next: Record<string, unknown>,
  prev: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!prev) return next;
  const keep = ["description", "remarks", "pickupTime", "duration", "vehicle", "guide", "voucher"] as const;
  const out = { ...next };
  for (const k of keep) {
    if (prev[k] != null && String(prev[k]).trim() !== "") out[k] = prev[k];
  }
  return out;
}

function timeSortKey(item: Record<string, unknown>): string {
  const t = String(item.pickupTime || item.depTime || item.time || "").trim();
  return t || "99:99";
}

function sortDayItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const autos = items.filter(isAutoItem);
  const manuals = items.filter((i) => !isAutoItem(i));
  autos.sort((a, b) => {
    const ta = TYPE_ORDER[String(a.itemType || "MANUAL")] ?? 99;
    const tb = TYPE_ORDER[String(b.itemType || "MANUAL")] ?? 99;
    if (ta !== tb) return ta - tb;
    return timeSortKey(a).localeCompare(timeSortKey(b));
  });
  // Autos first in chronological/service order; manuals keep relative order after autos
  // (manuals that had positions interleaved are appended — non-aggressive).
  return [...autos, ...manuals];
}

/** Trip night dates from stay windows (preferred) or hotels — no extra checkout day. */
export function buildTripNightDates(
  stayWindows: TripCityStayWindow[] | undefined,
  hotels: Record<string, unknown>[] | undefined,
  travelStartDate?: string,
): Array<{ date: string; city: string }> {
  if (stayWindows && stayWindows.length) {
    const out: Array<{ date: string; city: string }> = [];
    for (const w of stayWindows) {
      for (let n = 0; n < w.nights; n++) {
        const date = addDaysYmd(w.checkIn, n);
        if (date) out.push({ date, city: w.city });
      }
    }
    return out;
  }

  const sorted = [...(hotels || [])]
    .filter((h) => h && typeof h === "object")
    .sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));

  const out: Array<{ date: string; city: string }> = [];
  const seen = new Set<string>();
  for (const hotel of sorted) {
    const city = String(hotel.tripCity || hotel.city || "").trim();
    const checkIn = String(hotel.checkIn || travelStartDate || "").trim();
    const nights = Math.max(
      1,
      Number(hotel.nights) || stayNights(String(hotel.checkIn || ""), String(hotel.checkOut || "")) || 1,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) continue;
    for (let n = 0; n < nights; n++) {
      const date = addDaysYmd(checkIn, n);
      if (!date || seen.has(date)) continue;
      seen.add(date);
      out.push({ date, city });
    }
  }
  return out;
}

function hotelItemsForStay(
  hotel: Record<string, unknown>,
  index: number,
  date: string,
  isCheckIn: boolean,
  isCheckoutMorning: boolean,
): Record<string, unknown>[] {
  const id = lineKey(hotel, "hotel", index);
  const name = String(hotel.hotelName || hotel.name || "Hotel").trim();
  const city = String(hotel.tripCity || hotel.city || "").trim();
  const room = String(hotel.roomType || "").trim();
  const meal = String(hotel.mealPlan || "").trim();
  const rooms = hotel.rooms != null ? `${hotel.rooms} room(s)` : "";
  const checkIn = String(hotel.checkIn || "").trim();
  const checkOut = String(hotel.checkOut || "").trim();
  const nights = hotel.nights != null ? `${hotel.nights} night(s)` : "";
  const detail = [name, room, meal, rooms, checkIn && checkOut ? `${checkIn} → ${checkOut}` : "", nights]
    .filter(Boolean)
    .join(" · ");

  const items: Record<string, unknown>[] = [];
  if (isCheckoutMorning) {
    items.push({
      itemType: "HOTEL",
      activityName: `Hotel checkout — ${name}`,
      description: detail,
      pickupTime: String(hotel.checkOutTime || "11:00"),
      duration: "",
      vehicle: "",
      guide: "",
      voucher: "",
      remarks: "",
      autoFromHotel: true,
      hotelLineId: id,
      sourceKey: `hotel:${id}:checkout`,
    });
  }
  if (isCheckIn) {
    items.push({
      itemType: "HOTEL",
      activityName: `Hotel check-in — ${name}`,
      description: detail,
      pickupTime: String(hotel.checkInTime || "14:00"),
      duration: "",
      vehicle: "",
      guide: "",
      voucher: "",
      remarks: city ? `City: ${city}` : "",
      autoFromHotel: true,
      hotelLineId: id,
      sourceKey: `hotel:${id}:checkin`,
    });
  } else if (!isCheckoutMorning) {
    items.push({
      itemType: "HOTEL",
      activityName: `Stay — ${name}`,
      description: detail,
      pickupTime: "",
      duration: "",
      vehicle: "",
      guide: "",
      voucher: "",
      remarks: "",
      autoFromHotel: true,
      hotelLineId: id,
      sourceKey: `hotel:${id}:stay:${date}`,
    });
  }
  return items;
}

export function flightItineraryItem(flight: Record<string, unknown>, index: number): Record<string, unknown> {
  const id = lineKey(flight, "flight", index);
  const airline = String(flight.airline || "").trim();
  const code = String(flight.airlineCode || "").trim();
  const number = String(flight.flightNumber || flight.flightNo || "").trim();
  const from = String(flight.from || "").trim();
  const to = String(flight.to || "").trim();
  const times = [flight.depTime, flight.arrTime].filter(Boolean).join(" → ");
  const stops = flight.stops != null && flight.stops !== "" ? `${flight.stops} stop(s)` : "";
  const label = [airline, code && `(${code})`, number].filter(Boolean).join(" ");
  return {
    itemType: "FLIGHT",
    activityName: from && to ? `Flight ${from} → ${to}` : "Flight",
    description: [label, times, stops, flight.cabinClass || flight.cabin, flight.baggage, flight.duration]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" · "),
    pickupTime: String(flight.depTime || ""),
    duration: String(flight.duration || ""),
    vehicle: "",
    guide: "",
    voucher: String(flight.pnr || ""),
    remarks: String(flight.remarks || ""),
    autoFromFlight: true,
    flightLineId: id,
    sourceKey: `flight:${id}`,
    flightSource: String(flight.source || ""),
    stops: flight.stops,
    airlineCode: code,
    journeyId: flight.journeyId,
    segmentIndex: flight.segmentIndex,
  };
}

function transferItem(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const id = lineKey(row, "transfer", index);
  const type = String(row.transferType || row.name || "Transfer").trim();
  const pickup = String(row.pickup || "").trim();
  const drop = String(row.drop || "").trim();
  const route = pickup && drop ? `${pickup} → ${drop}` : pickup || drop;
  const paxBit = row.pax != null && String(row.pax).trim() !== "" ? `${row.pax} pax` : "";
  return {
    itemType: "TRANSFER",
    activityName: type,
    description: [route, row.vehicleType, paxBit, row.remarks]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" · "),
    pickupTime: String(row.pickupTime || row.time || "").trim(),
    duration: String(row.duration || ""),
    vehicle: String(row.vehicleType || ""),
    guide: "",
    voucher: String(row.voucher || ""),
    remarks: String(row.remarks || ""),
    autoFromTransfer: true,
    transferLineId: id,
    sourceKey: row.autoKey ? `transfer:${row.autoKey}` : `transfer:${id}`,
  };
}

function activityItem(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const id = lineKey(row, "activity", index);
  const name = String(row.activityName || row.name || "Activity").trim();
  const city = String(row.city || row.tripCity || "").trim();
  const pax = [
    row.adults != null ? `${row.adults} adult(s)` : "",
    row.children != null && Number(row.children) > 0 ? `${row.children} child(ren)` : "",
  ].filter(Boolean).join(", ");
  return {
    itemType: "ACTIVITY",
    activityName: name,
    description: [city ? `City: ${city}` : "", row.description, row.duration || row.timeSlot, pax, row.remarks]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .join(" · "),
    pickupTime: String(row.timeSlot || row.startTime || row.time || "").trim(),
    duration: String(row.duration || ""),
    vehicle: "",
    guide: "",
    voucher: String(row.voucher || ""),
    remarks: String(row.remarks || ""),
    autoFromActivity: true,
    activityLineId: id,
    sourceKey: `activity:${id}`,
  };
}

function mealItem(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const id = lineKey(row, "meal", index);
  const type = String(row.mealType || row.name || "Meal").trim();
  const city = String(row.city || row.tripCity || "").trim();
  const pax = [
    row.adults != null ? `${row.adults} adult(s)` : "",
    row.children != null && Number(row.children) > 0 ? `${row.children} child(ren)` : "",
    row.infants != null && Number(row.infants) > 0 ? `${row.infants} infant(s)` : "",
  ].filter(Boolean).join(", ");
  const dietary = String(row.dietary || "").trim();
  return {
    itemType: "MEAL",
    activityName: type,
    description: [
      city ? `City: ${city}` : "",
      row.restaurant,
      row.location,
      row.cuisine,
      row.description,
      pax,
      dietary ? `Dietary: ${dietary}` : "",
    ].map((v) => String(v || "").trim()).filter(Boolean).join(" · "),
    pickupTime: String(row.time || row.timeSlot || "").trim(),
    duration: String(row.duration || ""),
    vehicle: "",
    guide: "",
    voucher: String(row.voucher || ""),
    remarks: String(row.remarks || ""),
    autoFromMeal: true,
    mealLineId: id,
    sourceKey: `meal:${id}`,
  };
}

function stripAllAutoItems(days: Record<string, unknown>[]): {
  days: Record<string, unknown>[];
  preserved: Map<string, Record<string, unknown>>;
} {
  const preserved = new Map<string, Record<string, unknown>>();
  const next = days.map((day) => {
    const kept: Record<string, unknown>[] = [];
    for (const item of asItems(day)) {
      if (isAutoItem(item)) {
        const key = String(item.sourceKey || "");
        if (key) preserved.set(key, item);
      } else {
        kept.push(item);
      }
    }
    return { ...day, items: kept };
  });
  return { days: next, preserved };
}

function ensureDay(
  days: Record<string, unknown>[],
  date: string,
  city: string,
): Record<string, unknown> {
  let day = days.find((d) => String(d.date || "") === date);
  if (day) {
    if (!day.city && city) day.city = city;
    return day;
  }
  day = {
    day: days.length + 1,
    title: `Day ${days.length + 1} — ${city || date}`,
    city,
    date,
    mealPlan: "",
    coverImage: "",
    gallery: [],
    autoSkeleton: true,
    items: [],
  };
  days.push(day);
  return day;
}

function finalizeDays(days: Record<string, unknown>[]): Record<string, unknown>[] {
  // Drop empty auto-only skeleton days (no manual items, no content)
  const filtered = days.filter((d) => {
    const items = asItems(d);
    if (items.length > 0) return true;
    if (isManualDay(d) && d.manualDay === true) return true;
    if (d.autoSkeleton === true || d.autoFromHotel === true || d.autoFromFlightDay === true) {
      // Keep skeleton trip nights even if empty of items? Keep dated skeleton for trip structure.
      return Boolean(d.date);
    }
    return true;
  });

  filtered.sort((a, b) => {
    const da = String(a.date || "");
    const db = String(b.date || "");
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (!da && db) return 1;
    return Number(a.day || 0) - Number(b.day || 0);
  });

  return filtered.map((d, i) => {
    const city = String(d.city || "").trim();
    const dateLabel = formatItineraryDate(String(d.date || ""));
    const defaultTitle = [`Day ${i + 1}`, dateLabel, city].filter(Boolean).join(" — ");
    const titleLocked = d.titleLocked === true;
    const items = sortDayItems(asItems(d).map((it) => ({ ...it })));
    return {
      ...d,
      day: i + 1,
      title: titleLocked ? String(d.title || defaultTitle) : defaultTitle,
      items,
    };
  });
}

/**
 * Safe full sync: refresh AUTO items from package services; preserve manual days/items.
 * Does not create an extra checkout-only day after the last night.
 */
export function syncPackageItinerary(
  existing: unknown,
  input: ItinerarySyncInput,
): Record<string, unknown>[] {
  const base = (Array.isArray(existing) ? existing : [])
    .map(asDay)
    .filter((d): d is Record<string, unknown> => Boolean(d))
    .map((d) => ({ ...d, items: [...asItems(d)] }));

  const { days: stripped, preserved } = stripAllAutoItems(base);
  let days = stripped;

  const nightDates = buildTripNightDates(input.stayWindows, input.hotels, input.travelStartDate);
  for (const n of nightDates) {
    const day = ensureDay(days, n.date, n.city);
    // Refresh city from current trip plan for non-manual days (city-night changes).
    if (day.manualDay !== true && n.city) {
      day.city = n.city;
      if (day.titleLocked !== true) {
        // title refreshed in finalizeDays
      }
    }
  }

  // Hotels
  const hotels = (input.hotels || []).filter((h) => h && typeof h === "object");
  hotels.forEach((hotel, hi) => {
    const checkIn = String(hotel.checkIn || "").trim();
    const checkOut = String(hotel.checkOut || "").trim();
    const nights = Math.max(
      1,
      Number(hotel.nights) || stayNights(checkIn, checkOut) || 1,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return;
    const city = String(hotel.tripCity || hotel.city || "").trim();

    for (let n = 0; n < nights; n++) {
      const date = addDaysYmd(checkIn, n);
      if (!date) continue;
      const day = ensureDay(days, date, city);
      const isCheckIn = n === 0;
      for (const raw of hotelItemsForStay(hotel, hi, date, isCheckIn, false)) {
        const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
        const items = asItems(day);
        if (!items.some((i) => String(i.sourceKey) === String(item.sourceKey))) items.push(item);
        day.items = items;
      }
      if (!day.hotelName) day.hotelName = String(hotel.hotelName || hotel.name || "");
      if (hotel.mealPlan && !day.mealPlan) day.mealPlan = String(hotel.mealPlan);
      if (hotel.imageUrl && !day.coverImage) day.coverImage = String(hotel.imageUrl);
    }

    // Transition morning: checkout on checkOut date (first day of next city / departure day of stay)
    if (/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      // Only add checkout if checkOut is still within trip night dates OR equals next city's check-in
      const onTrip = nightDates.some((n) => n.date === checkOut)
        || hotels.some((h, j) => j !== hi && String(h.checkIn || "") === checkOut);
      if (onTrip) {
        const day = ensureDay(
          days,
          checkOut,
          String(
            hotels.find((h, j) => j !== hi && String(h.checkIn || "") === checkOut)?.tripCity
            || hotels.find((h, j) => j !== hi && String(h.checkIn || "") === checkOut)?.city
            || city,
          ),
        );
        for (const raw of hotelItemsForStay(hotel, hi, checkOut, false, true)) {
          const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
          const items = asItems(day);
          if (!items.some((i) => String(i.sourceKey) === String(item.sourceKey))) items.push(item);
          day.items = items;
        }
      }
    }
  });

  // Flights
  (input.flights || []).forEach((f, i) => {
    if (!f || typeof f !== "object") return;
    const date = String(f.date || input.travelStartDate || "").trim();
    if (!date) return;
    const day = ensureDay(days, date, String(f.to || f.destinationCity || "").trim());
    const raw = flightItineraryItem(f, i);
    const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
    const items = asItems(day);
    if (!items.some((it) => String(it.sourceKey) === String(item.sourceKey))) items.push(item);
    day.items = items;
  });

  // Transfers
  (input.transfers || []).forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    const date = String(t.date || "").trim();
    if (!date) return;
    const day = ensureDay(days, date, String(t.city || t.to || "").trim());
    const raw = transferItem(t, i);
    const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
    const items = asItems(day);
    if (!items.some((it) => String(it.sourceKey) === String(item.sourceKey))) items.push(item);
    day.items = items;
  });

  // Activities
  (input.activities || []).forEach((a, i) => {
    if (!a || typeof a !== "object") return;
    const date = String(a.date || "").trim();
    if (!date) return;
    const day = ensureDay(days, date, String(a.city || a.tripCity || "").trim());
    const raw = activityItem(a, i);
    const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
    const items = asItems(day);
    if (!items.some((it) => String(it.sourceKey) === String(item.sourceKey))) items.push(item);
    day.items = items;
  });

  // Meals module (not free-text mealPlan)
  (input.meals || []).forEach((m, i) => {
    if (!m || typeof m !== "object") return;
    if (m.includedInPlan === true || m.included === true) return;
    const date = String(m.date || "").trim();
    if (!date) return;
    const day = ensureDay(days, date, String(m.city || m.tripCity || "").trim());
    const raw = mealItem(m, i);
    const item = mergePreserved(raw, preserved.get(String(raw.sourceKey)));
    const items = asItems(day);
    if (!items.some((it) => String(it.sourceKey) === String(item.sourceKey))) items.push(item);
    day.items = items;
  });

  return finalizeDays(days);
}

/** @deprecated Prefer syncPackageItinerary — kept for Module 03A call sites/tests. */
export function mergeFlightsIntoItinerary(
  existingDays: unknown,
  flights: Record<string, unknown>[],
  opts: { travelStartDate?: string } = {},
): Record<string, unknown>[] {
  return syncPackageItinerary(existingDays, {
    flights,
    travelStartDate: opts.travelStartDate,
  });
}

export function stripAutoFlightItems(days: Record<string, unknown>[]): Record<string, unknown>[] {
  return days
    .map((day): Record<string, unknown> => ({
      ...day,
      items: asItems(day).filter((item) => item.autoFromFlight !== true),
    }))
    .filter((day) => {
      if (day.autoFromFlightDay === true && asItems(day).length === 0) return false;
      return true;
    });
}

export function isAutoManagedItineraryDay(day: Record<string, unknown>): boolean {
  return day.autoFromHotel === true || day.autoFromFlightDay === true || day.autoSkeleton === true;
}

export function itemTypeLabel(type: unknown): string {
  const t = String(type || "").toUpperCase();
  if (t === "FLIGHT") return "Flight";
  if (t === "HOTEL") return "Hotel";
  if (t === "TRANSFER") return "Transfer";
  if (t === "ACTIVITY") return "Activity";
  if (t === "MEAL") return "Meal";
  return "Manual";
}
