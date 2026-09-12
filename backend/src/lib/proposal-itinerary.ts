/** Day-itinerary builder helpers for TravelProposal snapshots. */

export type ItineraryLineSource = "catalog" | "amadeus" | "manual";

export type ItineraryLineItem = {
  id: string;
  productId?: string | null;
  externalId?: string | null;
  source: ItineraryLineSource;
  name: string;
  meta?: Record<string, unknown>;
  unitPrice: number;
  qty: number;
  total: number;
  currency: string;
};

export type ItineraryCity = {
  city: string;
  nights: number;
  destinationId?: string | null;
};

export type ItineraryTripMeta = {
  title: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  currency: string;
  cities: ItineraryCity[];
  notes?: string | null;
};

export type ItineraryDay = {
  dayNumber: number;
  date: string;
  city: string;
  destinationId?: string | null;
  hotel?: ItineraryLineItem | null;
  transfers: ItineraryLineItem[];
  activities: ItineraryLineItem[];
  meals: ItineraryLineItem[];
  misc: ItineraryLineItem[];
  dayTotal: number;
};

export type ItineraryPricing = {
  hotelCost: number;
  activityCost: number;
  transferCost: number;
  mealCost: number;
  miscCost: number;
  packageBase: number;
  markup: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeEndDate(startDate: string, cities: ItineraryCity[]): string {
  const nights = cities.reduce((sum, c) => sum + Math.max(0, Number(c.nights) || 0), 0);
  return addDays(startDate, Math.max(0, nights));
}

/** Expand city+nights into day cards. N nights in a city → N+1 calendar days spanning that stay for the last city segment; overall trip days = sum(nights)+1. */
export function expandCitiesToDays(startDate: string, cities: ItineraryCity[]): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  let offset = 0;
  const totalNights = cities.reduce((s, c) => s + Math.max(0, Number(c.nights) || 0), 0);
  if (!cities.length || totalNights <= 0) {
    return [{
      dayNumber: 1,
      date: startDate,
      city: cities[0]?.city || "",
      destinationId: cities[0]?.destinationId ?? null,
      hotel: null,
      transfers: [],
      activities: [],
      meals: [],
      misc: [],
      dayTotal: 0,
    }];
  }

  for (let ci = 0; ci < cities.length; ci++) {
    const city = cities[ci];
    const nights = Math.max(0, Number(city.nights) || 0);
    // Each night produces a day card for that city; last city also gets departure day.
    const dayCount = ci === cities.length - 1 ? nights + 1 : nights;
    for (let i = 0; i < dayCount; i++) {
      days.push({
        dayNumber: days.length + 1,
        date: addDays(startDate, offset),
        city: city.city,
        destinationId: city.destinationId ?? null,
        hotel: null,
        transfers: [],
        activities: [],
        meals: [],
        misc: [],
        dayTotal: 0,
      });
      offset += 1;
    }
  }
  return days;
}

function lineTotal(item: ItineraryLineItem | null | undefined): number {
  if (!item) return 0;
  const unit = Number(item.unitPrice) || 0;
  const qty = Math.max(0, Number(item.qty) || 0);
  return Math.max(0, Math.round(unit * qty));
}

export function normalizeLineItem(raw: Partial<ItineraryLineItem> & { name: string }): ItineraryLineItem {
  const unitPrice = Math.max(0, Number(raw.unitPrice) || 0);
  const qty = Math.max(0, Number(raw.qty) || 1);
  return {
    id: raw.id || `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: raw.productId ?? null,
    externalId: raw.externalId ?? null,
    source: (raw.source as ItineraryLineSource) || "manual",
    name: String(raw.name || "Item").trim() || "Item",
    meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
    unitPrice,
    qty,
    total: Math.max(0, Math.round(unitPrice * qty)),
    currency: String(raw.currency || "INR"),
  };
}

export function recomputeDayTotal(day: ItineraryDay): number {
  const hotel = lineTotal(day.hotel);
  const transfers = (day.transfers || []).reduce((s, x) => s + lineTotal(x), 0);
  const activities = (day.activities || []).reduce((s, x) => s + lineTotal(x), 0);
  const meals = (day.meals || []).reduce((s, x) => s + lineTotal(x), 0);
  const misc = (day.misc || []).reduce((s, x) => s + lineTotal(x), 0);
  return hotel + transfers + activities + meals + misc;
}

export function normalizeDays(days: ItineraryDay[]): ItineraryDay[] {
  return (days || []).map((d, idx) => {
    const hotel = d.hotel ? normalizeLineItem(d.hotel) : null;
    const transfers = (d.transfers || []).map((x) => normalizeLineItem(x));
    const activities = (d.activities || []).map((x) => normalizeLineItem(x));
    const meals = (d.meals || []).map((x) => normalizeLineItem(x));
    const misc = (d.misc || []).map((x) => normalizeLineItem(x));
    const day: ItineraryDay = {
      dayNumber: d.dayNumber || idx + 1,
      date: d.date,
      city: d.city,
      destinationId: d.destinationId ?? null,
      hotel,
      transfers,
      activities,
      meals,
      misc,
      dayTotal: 0,
    };
    day.dayTotal = recomputeDayTotal(day);
    return day;
  });
}

export function recomputeItineraryPricing(
  days: ItineraryDay[],
  markup = 0,
  discount = 0,
  tax = 0,
  currency = "INR"
): ItineraryPricing {
  let hotelCost = 0;
  let activityCost = 0;
  let transferCost = 0;
  let mealCost = 0;
  let miscCost = 0;
  for (const d of days) {
    hotelCost += lineTotal(d.hotel);
    transferCost += (d.transfers || []).reduce((s, x) => s + lineTotal(x), 0);
    activityCost += (d.activities || []).reduce((s, x) => s + lineTotal(x), 0);
    mealCost += (d.meals || []).reduce((s, x) => s + lineTotal(x), 0);
    miscCost += (d.misc || []).reduce((s, x) => s + lineTotal(x), 0);
  }
  const packageBase = hotelCost + activityCost + transferCost + mealCost + miscCost;
  const subtotal = Math.max(0, packageBase + Number(markup || 0) - Number(discount || 0));
  const total = Math.max(0, subtotal + Number(tax || 0));
  return {
    hotelCost,
    activityCost,
    transferCost,
    mealCost,
    miscCost,
    packageBase,
    markup: Number(markup) || 0,
    discount: Number(discount) || 0,
    tax: Number(tax) || 0,
    total,
    currency,
  };
}

export function buildEmptyItinerarySnapshot(input: {
  trip: ItineraryTripMeta;
  customer?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
  branding?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
}) {
  const days = normalizeDays(expandCitiesToDays(input.trip.startDate, input.trip.cities));
  const pricing = recomputeItineraryPricing(days, 0, 0, 0, input.trip.currency);
  return {
    capturedAt: new Date().toISOString(),
    builderMode: "day_itinerary" as const,
    requirement: null,
    customer: input.customer ?? null,
    lead: input.lead ?? null,
    destination: input.trip.cities[0]
      ? { name: input.trip.cities[0].city, id: input.trip.cities[0].destinationId ?? null }
      : null,
    package: {
      packageName: input.trip.title,
      durationNights: input.trip.cities.reduce((s, c) => s + Math.max(0, c.nights), 0),
      durationDays: days.length,
      days: [],
    },
    productOptions: [] as Record<string, unknown>[],
    productPrices: {} as Record<string, number>,
    productSelections: {
      hotelOptionGroup: null,
      activityOptionGroup: null,
      transferOptionGroup: null,
    },
    pricing: {
      hotelCost: pricing.hotelCost,
      activityCost: pricing.activityCost,
      transferCost: pricing.transferCost,
      mealCost: pricing.mealCost,
      miscCost: pricing.miscCost,
      packageBase: pricing.packageBase,
      markup: pricing.markup,
      discount: pricing.discount,
      tax: pricing.tax,
      total: pricing.total,
      currency: pricing.currency,
    },
    template: input.template ?? null,
    branding: input.branding ?? null,
    terms: {
      inclusions: [] as string[],
      exclusions: [] as string[],
      termsText: "",
      cancellationText: "",
      visaRequired: false,
      visaDetails: "",
    },
    trip: input.trip,
    days,
  };
}
