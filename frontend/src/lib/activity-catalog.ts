/** Malaysia activity / ticket catalogue helpers (KTH sheet). */

const ACTIVITY_IMAGE =
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";

export function activityPlaceholderImage(): string {
  return ACTIVITY_IMAGE;
}

/**
 * Map trip city (Basic Details) → KTH ticket location for filtering.
 */
export function resolveActivityLocationCity(city: string): string {
  const key = city.trim().toLowerCase();
  if (!key) return "Kuala Lumpur";
  if (/genting/.test(key)) return "Genting Highlands";
  if (/malacca|melaka|alor gajah/.test(key)) return "Malacca";
  if (/penang|georgetown|george town/.test(key)) return "Penang";
  if (/langkawi/.test(key)) return "Langkawi";
  if (/johor|jb\b/.test(key)) return "Johor Bahru";
  if (/putrajaya/.test(key)) return "Putrajaya";
  if (/selangor|firefl|kuala selangor/.test(key)) return "Kuala Selangor";
  if (/ipoh|tambun/.test(key)) return "Tambun";
  if (/kedah/.test(key)) return "Kuala Kedah";
  return "Kuala Lumpur";
}

export function activityMatchesTripCity(
  item: { location?: string | null; city?: string | null; name?: string | null },
  tripCity: string,
): boolean {
  const resolved = resolveActivityLocationCity(tripCity).toLowerCase();
  const hay = [item.location, item.city, item.name]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  if (resolved === "penang") {
    return /penang/.test(hay);
  }
  return hay.includes(resolved.toLowerCase()) || hay.includes(tripCity.trim().toLowerCase());
}

export function formatActivitySchedule(item: {
  startTime?: string | null;
  closingTime?: string | null;
  duration?: string | null;
  operatingHours?: string | null;
}): string {
  const start = String(item.startTime || "").trim();
  const close = String(item.closingTime || "").trim();
  const duration = String(item.duration || "").trim();
  const hours = String(item.operatingHours || "").trim();
  const parts: string[] = [];
  if (start) parts.push(`Starts: ${formatDisplayTime(start)}`);
  if (close) parts.push(`Close: ${formatDisplayTime(close)}`);
  if (duration) parts.push(`Duration: ${duration}`);
  if (!parts.length && hours) return hours;
  if (!parts.length) return "Timing on request";
  return parts.join(" | ");
}

/** Timing bar copy matching activity details popup: "Starts 11:00 AM · Closes 09:00 PM · 8 Hours". */
export function formatActivityTimingBar(item: {
  startTime?: string | null;
  closingTime?: string | null;
  duration?: string | null;
  operatingHours?: string | null;
  timeSlot?: string | null;
}): string {
  const start = String(item.startTime || item.timeSlot || "").trim();
  const close = String(item.closingTime || "").trim();
  const duration = String(item.duration || "").trim();
  const hours = String(item.operatingHours || "").trim();
  const parts: string[] = [];
  if (start) parts.push(`Starts ${formatDisplayTime(start)}`);
  if (close) parts.push(`Closes ${formatDisplayTime(close)}`);
  if (duration) parts.push(duration);
  if (!parts.length && hours) return hours;
  if (!parts.length) return "Timing on request";
  return parts.join(" · ");
}

export function formatDisplayTime(value: string): string {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})\b/);
  if (!m) return raw;
  let h = Number(m[1]);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${min} ${ap}`;
}

export function asActivityStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || "").trim()).filter(Boolean);
      }
    } catch {
      /* plain text */
    }
    return value
      .split(/\n|;|•/)
      .map((v) => v.replace(/^[-–•\s]+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function defaultTourInclusions(item: { name?: string | null; ticketType?: string | null }): string[] {
  const name = String(item.name || "");
  const base = [
    "Private air-conditioned vehicle",
    "Driver service as per itinerary",
    "Hotel pickup & drop-off (where applicable)",
  ];
  if (/disposal/i.test(name)) {
    return [...base, "Vehicle at disposal within city limits for the booked hours"];
  }
  if (/dinner/i.test(name)) {
    return [...base, "Enroute dinner transfer stop (meals not included unless stated)"];
  }
  return base;
}

export function defaultTourExclusions(item: { name?: string | null }): string[] {
  const name = String(item.name || "");
  const base = [
    "Personal expenses",
    "Food and beverages (unless stated)",
    "Tips and gratuities",
  ];
  if (/optional|entrance ticket/i.test(name)) {
    return ["Entrance / attraction tickets (optional add-on)", ...base];
  }
  return base;
}

export function isTourActivity(item: { ticketType?: string | null; activityCategory?: string | null }): boolean {
  const key = String(item.ticketType || item.activityCategory || "").trim();
  return /^tours?$/i.test(key);
}

/** Line total for an activity / ticket product (accepts catalogue ProductRecord). */
export function activityLineTotal(
  item: object,
  adults: number,
  children: number,
): number {
  const rec = item as Record<string, unknown>;
  const adult = Number(rec.adultPrice || 0);
  // KTH Tours are flat vehicle/tour rates (not per-pax tickets).
  if (isTourActivity({
    ticketType: rec.ticketType == null ? null : String(rec.ticketType),
    activityCategory: rec.activityCategory == null ? null : String(rec.activityCategory),
  })) return Math.max(0, adult);
  const child = Number(rec.childPrice ?? rec.adultPrice ?? 0);
  return Math.max(0, adult) * Math.max(0, adults) + Math.max(0, child) * Math.max(0, children);
}

/** Default Hotel → Activity → Hotel private vehicle options (KL Half Day Disposal 4H rates). */
export const ACTIVITY_TRANSFER_VEHICLES = [
  { id: "car", vehicleType: "Sedan / Car", label: "CAR", paxLabel: "1-3 Pax", price: 4845 },
  { id: "van10", vehicleType: "Van 10-seater", label: "10-SEATER", paxLabel: "4-6 Pax", price: 5795 },
  { id: "van18", vehicleType: "Van 18-seater", label: "18-SEATER", paxLabel: "7-13 Pax", price: 7125 },
  { id: "van18g", vehicleType: "Van 18-seater + Guide", label: "18 SEATER + GUIDE", paxLabel: "7-13 Pax", price: 14725 },
] as const;

export const ACTIVITY_TRANSFER_ROUTE = "Hotel → Activity → Hotel (Private)";
