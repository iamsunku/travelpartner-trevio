/** Meals helpers for Quotation Wizard (Module 06A). */

import type { TripCityStayWindow } from "./quote-trip-stays";
import { defaultActivityDateForCity, isDateInCityStay } from "./quote-transfers";

export { defaultActivityDateForCity as defaultMealDateForCity, isDateInCityStay };

function cityKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Hotel plan text that clearly includes breakfast. */
export function hotelMealPlanIncludesBreakfast(mealPlan: unknown): boolean {
  const raw = String(mealPlan || "").trim().toLowerCase();
  if (!raw) return false;
  if (/\b(no breakfast|without breakfast|breakfast not|excl\.?\s*breakfast)\b/.test(raw)) return false;
  return (
    /\bbreakfast\b/.test(raw)
    || /\b(bb|b&b)\b/.test(raw)
    || /\bhalf\s*board\b|\bhb\b/.test(raw)
    || /\bfull\s*board\b|\bfb\b/.test(raw)
    || /\ball\s*inclusive\b|\bai\b/.test(raw)
  );
}

export function mealTypeIsBreakfast(mealType: unknown): boolean {
  return /\bbreakfast\b/i.test(String(mealType || "").trim());
}

/**
 * Awareness only: hotel stay includes breakfast for the meal's city/date.
 * Does not mutate prices or delete meals.
 */
export function hotelBreakfastDuplicationWarning(opts: {
  mealType: unknown;
  mealCity?: unknown;
  mealDate?: unknown;
  hotels: unknown;
}): string | null {
  if (!mealTypeIsBreakfast(opts.mealType)) return null;
  if (!Array.isArray(opts.hotels)) return null;
  const mealCity = cityKey(opts.mealCity);
  const mealDate = String(opts.mealDate || "").trim();

  for (const raw of opts.hotels) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const hotel = raw as Record<string, unknown>;
    if (!hotelMealPlanIncludesBreakfast(hotel.mealPlan)) continue;
    const hotelCity = cityKey(hotel.tripCity || hotel.city);
    if (mealCity && hotelCity && mealCity !== hotelCity) continue;
    const checkIn = String(hotel.checkIn || "").trim();
    const checkOut = String(hotel.checkOut || "").trim();
    if (mealDate && /^\d{4}-\d{2}-\d{2}$/.test(mealDate) && /^\d{4}-\d{2}-\d{2}$/.test(checkIn)) {
      if (mealDate < checkIn) continue;
      if (checkOut && mealDate >= checkOut) continue;
    }
    const name = String(hotel.hotelName || hotel.name || "Selected hotel").trim();
    return `Breakfast may already be included in the selected hotel stay (${name}).`;
  }
  return null;
}

/**
 * Sync meal rows when trip stay windows change.
 * - dateSource AUTO: shift date into the city's new window.
 * - dateSource MANUAL (or legacy): keep date; flag if invalid/orphan.
 * Never deletes meals.
 */
export function syncMealRowsToTripStays(
  meals: Record<string, unknown>[],
  windows: TripCityStayWindow[],
): Record<string, unknown>[] {
  const citySet = new Set(windows.map((w) => cityKey(w.city)).filter(Boolean));

  return meals.map((line) => {
    const city = String(line.city || line.tripCity || "").trim();
    const date = String(line.date || "").trim();
    const dateSource = String(line.dateSource || "").toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
    const next: Record<string, unknown> = { ...line };

    if (city && citySet.size > 0 && !citySet.has(cityKey(city))) {
      next.cityOrphan = true;
      next.cityOrphanReason = `City "${city}" is no longer in the trip plan — reassign the meal city.`;
    } else {
      delete next.cityOrphan;
      delete next.cityOrphanReason;
    }

    if (!city) return next;

    const inWindow = isDateInCityStay(windows, city, date);
    if (dateSource === "AUTO") {
      if (!date || !inWindow) {
        const safe = defaultActivityDateForCity(windows, city);
        if (safe) {
          next.date = safe;
          next.dateSource = "AUTO";
          delete next.dateInvalid;
          delete next.dateInvalidReason;
        }
      } else {
        delete next.dateInvalid;
        delete next.dateInvalidReason;
      }
      return next;
    }

    if (date && !inWindow && citySet.has(cityKey(city))) {
      next.dateInvalid = true;
      next.dateInvalidReason = `Date ${date} is outside the ${city} stay window.`;
    } else {
      delete next.dateInvalid;
      delete next.dateInvalidReason;
    }
    return next;
  });
}

/** Apply city change: reset date when outside new stay (prefer valid default). */
export function applyMealCityChange(
  row: Record<string, unknown>,
  city: string,
  windows: TripCityStayWindow[],
): Record<string, unknown> {
  const currentDate = String(row.date || "");
  const next: Record<string, unknown> = { ...row, city };
  delete next.cityOrphan;
  delete next.cityOrphanReason;

  if (!city) {
    next.date = "";
    next.dateSource = "AUTO";
    return next;
  }

  if (!currentDate || !isDateInCityStay(windows, city, currentDate)) {
    const safe = defaultActivityDateForCity(windows, city);
    next.date = safe;
    next.dateSource = "AUTO";
    delete next.dateInvalid;
    delete next.dateInvalidReason;
  }
  return next;
}
