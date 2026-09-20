/** Static miscellaneous / add-on catalogue for trip builder + optional add-ons. */

export type MiscCatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  /** How the listed selling price is charged. */
  unit: "PER_BOOKING" | "PER_PAX" | "PER_DAY";
};

export const MISC_CATALOG: MiscCatalogItem[] = [
  {
    id: "misc-travel-insurance",
    name: "Travel Insurance (Single Trip)",
    category: "Insurance",
    description: "Basic overseas medical + trip cancellation cover for the quoted travel dates.",
    costPrice: 450,
    sellingPrice: 899,
    unit: "PER_PAX",
  },
  {
    id: "misc-esim",
    name: "eSIM Data Pack (Malaysia)",
    category: "Connectivity",
    description: "Instant digital SIM with data — QR activation on arrival. Valid for trip duration.",
    costPrice: 500,
    sellingPrice: 899,
    unit: "PER_PAX",
  },
  {
    id: "misc-local-sim",
    name: "International SIM Card",
    category: "Connectivity",
    description: "Physical local SIM with data & local calls. Delivered with travel documents.",
    costPrice: 400,
    sellingPrice: 799,
    unit: "PER_PAX",
  },
  {
    id: "misc-lounge",
    name: "Airport Lounge Access",
    category: "Airport",
    description: "Departure lounge pass (food, Wi‑Fi, seating) at origin or KLIA.",
    costPrice: 1500,
    sellingPrice: 2499,
    unit: "PER_PAX",
  },
  {
    id: "misc-meet-assist",
    name: "Airport Meet & Assist",
    category: "Airport",
    description: "Dedicated greeter through immigration / baggage and hotel transfer handoff.",
    costPrice: 1200,
    sellingPrice: 2199,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-porterage",
    name: "Porterage Assistance",
    category: "Airport",
    description: "Luggage handling at airport and hotel on arrival / departure day.",
    costPrice: 600,
    sellingPrice: 999,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-klia-express",
    name: "KLIA Ekspres Tickets",
    category: "Airport",
    description: "Airport rail tickets between KLIA and KL Sentral (one way per pax).",
    costPrice: 550,
    sellingPrice: 899,
    unit: "PER_PAX",
  },
  {
    id: "misc-early-checkin",
    name: "Early Check-in",
    category: "Hotel Extra",
    description: "Request early hotel check-in (subject to availability).",
    costPrice: 800,
    sellingPrice: 1500,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-late-checkout",
    name: "Late Check-out",
    category: "Hotel Extra",
    description: "Request late hotel check-out (subject to availability).",
    costPrice: 800,
    sellingPrice: 1500,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-private-guide-half",
    name: "Private Guide (Half Day)",
    category: "Guide",
    description: "Licensed local guide for ~4 hours of sightseeing / assistance.",
    costPrice: 2200,
    sellingPrice: 3499,
    unit: "PER_DAY",
  },
  {
    id: "misc-private-guide-full",
    name: "Private Guide (Full Day)",
    category: "Guide",
    description: "Dedicated local guide for a full sightseeing day (~8 hours).",
    costPrice: 3500,
    sellingPrice: 5499,
    unit: "PER_DAY",
  },
  {
    id: "misc-extra-excursion",
    name: "Extra Excursion / Day Trip",
    category: "Experiences",
    description: "Optional day trip or sightseeing add-on (details confirmed with ops).",
    costPrice: 2000,
    sellingPrice: 3500,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-birthday",
    name: "Birthday Decorations",
    category: "Celebration",
    description: "Room or venue birthday setup with balloons / cake arrangement.",
    costPrice: 1200,
    sellingPrice: 2499,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-honeymoon",
    name: "Honeymoon Setup",
    category: "Celebration",
    description: "Romantic room décor, flowers, and honeymoon amenities.",
    costPrice: 1500,
    sellingPrice: 2999,
    unit: "PER_BOOKING",
  },
  {
    id: "misc-accessories",
    name: "Travel Accessories Kit",
    category: "Essentials",
    description: "Adapters, pouch, and basic travel essentials for the group.",
    costPrice: 300,
    sellingPrice: 699,
    unit: "PER_BOOKING",
  },
];

/** Presets used by the quotation Optional Add-ons step (subset / same pricing). */
export const OPTIONAL_ADDON_PRESETS = MISC_CATALOG.map((item) => ({
  name: item.name,
  description: item.description,
  costPrice: item.costPrice,
  sellingPrice: item.sellingPrice,
}));

export function miscUnitLabel(unit: MiscCatalogItem["unit"]): string {
  if (unit === "PER_PAX") return "per guest";
  if (unit === "PER_DAY") return "per day";
  return "per booking";
}

export function miscLineSelling(
  item: Pick<MiscCatalogItem, "sellingPrice" | "unit">,
  adults: number,
  children = 0,
): number {
  const base = Math.max(0, Number(item.sellingPrice) || 0);
  if (item.unit === "PER_PAX") return base * Math.max(1, adults + Math.max(0, children));
  return base;
}

export function miscLineCost(
  item: Pick<MiscCatalogItem, "costPrice" | "unit">,
  adults: number,
  children = 0,
): number {
  const base = Math.max(0, Number(item.costPrice) || 0);
  if (item.unit === "PER_PAX") return base * Math.max(1, adults + Math.max(0, children));
  return base;
}
