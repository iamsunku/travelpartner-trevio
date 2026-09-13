import type { ProposalSnapshotData } from "../proposal-snapshot.js";
import type {
  PdfActivity,
  PdfDocumentContent,
  PdfHotel,
  PdfItineraryDay,
  PdfItineraryItem,
  PdfRenderInput,
  PdfTransfer,
} from "./types.js";

function str(value: unknown, fallback = ""): string {
  if (value == null || value === "") return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatDate(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function customerName(snapshot: ProposalSnapshotData): string {
  if (snapshot.customer?.name) return str(snapshot.customer.name);
  if (snapshot.lead?.customerName) return str(snapshot.lead.customerName);
  return "Guest";
}

function classifyPeriod(time: string): PdfItineraryItem["period"] {
  if (!time) return "Anytime";
  const hour = Number(String(time).split(":")[0]);
  if (!Number.isFinite(hour)) return "Anytime";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function firstImage(images: unknown): string | null {
  const arr = asArray(images);
  for (const img of arr) {
    if (typeof img === "string" && img.trim()) return img.trim();
    if (img && typeof img === "object") {
      const o = img as Record<string, unknown>;
      const url = str(o.url ?? o.src ?? o.image);
      if (url) return url;
    }
  }
  return null;
}

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((v) => str(v).trim())
    .filter(Boolean);
}

export function buildDocumentContent(input: PdfRenderInput): PdfDocumentContent {
  if (input.snapshot.builderMode === "day_itinerary") {
    return buildDayItineraryDocumentContent(input);
  }
  return buildPackageDocumentContent(input);
}

function buildDayItineraryDocumentContent(input: PdfRenderInput): PdfDocumentContent {
  const snapshot = input.snapshot;
  const trip = (snapshot.trip ?? {}) as Record<string, unknown>;
  const daysRaw = asArray(snapshot.days);

  const days: PdfItineraryDay[] = daysRaw.map((raw) => {
    const d = raw as Record<string, unknown>;
    const items: PdfItineraryItem[] = [];
    const hotel = d.hotel as Record<string, unknown> | null | undefined;
    if (hotel?.name) {
      items.push({
        time: "",
        title: `Hotel: ${str(hotel.name)}`,
        description: str((hotel.meta as Record<string, unknown> | undefined)?.room ?? ""),
        period: "Anytime",
      });
    }
    for (const t of asArray(d.transfers)) {
      const row = t as Record<string, unknown>;
      items.push({
        time: "",
        title: `Transfer: ${str(row.name)}`,
        description: str((row.meta as Record<string, unknown> | undefined)?.route ?? ""),
        period: "Anytime",
      });
    }
    for (const a of asArray(d.activities)) {
      const row = a as Record<string, unknown>;
      items.push({
        time: "",
        title: str(row.name, "Activity"),
        description: str((row.meta as Record<string, unknown> | undefined)?.description ?? ""),
        period: "Anytime",
      });
    }
    for (const m of asArray(d.meals)) {
      const row = m as Record<string, unknown>;
      const mealType = str((row.meta as Record<string, unknown> | undefined)?.mealType, "Meal");
      items.push({
        time: "",
        title: `${mealType}: ${str(row.name)}`,
        description: "",
        period: mealType === "Breakfast" ? "Morning" : mealType === "Dinner" ? "Evening" : "Afternoon",
      });
    }
    for (const x of asArray(d.misc)) {
      const row = x as Record<string, unknown>;
      items.push({
        time: "",
        title: str(row.name, "Misc"),
        description: str((row.meta as Record<string, unknown> | undefined)?.note ?? ""),
        period: "Anytime",
      });
    }
    return {
      dayNumber: num(d.dayNumber, 1),
      title: `Day ${num(d.dayNumber, 1)} — ${str(d.city)} (${formatDate(str(d.date))})`,
      items,
    };
  });

  const hotels: PdfHotel[] = [];
  const activities: PdfActivity[] = [];
  const transfers: PdfTransfer[] = [];
  for (const raw of daysRaw) {
    const d = raw as Record<string, unknown>;
    const hotel = d.hotel as Record<string, unknown> | null | undefined;
    if (hotel?.name && !hotels.some((h) => h.name === hotel.name)) {
      const meta = (hotel.meta as Record<string, unknown> | undefined) ?? {};
      hotels.push({
        name: str(hotel.name),
        category: (() => {
          const raw = str(meta.stars ?? meta.category, "Standard");
          if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}*`;
          return raw;
        })(),
        description: str(meta.description, "As selected in itinerary."),
        amenities: [],
        image: null,
        nights: 1,
        city: str(d.city),
      });
    }
    for (const a of asArray(d.activities)) {
      const row = a as Record<string, unknown>;
      const meta = (row.meta as Record<string, unknown> | undefined) ?? {};
      activities.push({
        name: str(row.name),
        description: str(meta.description, ""),
        duration: str(meta.duration, "—"),
        image: null,
        location: str(d.city),
      });
    }
    for (const t of asArray(d.transfers)) {
      const row = t as Record<string, unknown>;
      const meta = (row.meta as Record<string, unknown> | undefined) ?? {};
      transfers.push({
        name: str(row.name),
        vehicle: str(meta.vehicleType, "As assigned"),
        pickup: str(meta.pickup, "As per itinerary"),
        drop: str(meta.drop, "As per itinerary"),
        notes: "",
        type: str(meta.transferType, "Private"),
      });
    }
  }

  const adults = num(trip.adults, 1);
  const children = num(trip.children, 0);
  const paxLabel = `${adults} Adult${adults === 1 ? "" : "s"}${children ? ` + ${children} Child${children === 1 ? "" : "ren"}` : ""}`;
  const cities = asArray(trip.cities).map((c) => str((c as Record<string, unknown>).city)).filter(Boolean);
  const currency = str(snapshot.pricing.currency, "INR");
  const pricing = snapshot.pricing;

  return {
    proposalNumber: input.proposalNumber,
    proposalTitle: str(trip.title, "Travel Proposal"),
    customerName: customerName(snapshot),
    customerEmail: str(snapshot.customer?.email ?? snapshot.lead?.email),
    customerPhone: str(snapshot.customer?.phone ?? snapshot.lead?.phone),
    paxLabel,
    destination: cities.join(" → ") || str(snapshot.destination?.name, "Destination"),
    travelDates: trip.startDate
      ? `${formatDate(str(trip.startDate))} – ${formatDate(str(trip.endDate))}`
      : "Dates to be confirmed",
    duration: `${days.length} Days / ${num((snapshot.package as Record<string, unknown>)?.durationNights, Math.max(0, days.length - 1))} Nights`,
    generatedDate: formatDate(new Date()),
    validUntil: formatDate(input.validUntil),
    heroImage: str(snapshot.destination?.heroImage ?? snapshot.destination?.thumbnail) || null,
    highlights: snapshot.terms.inclusions.length ? snapshot.terms.inclusions : cities.map((c) => `Explore ${c}`),
    days,
    hotels: hotels.length
      ? hotels
      : [{ name: "As per day itinerary", category: "Standard", description: "", amenities: [], image: null, nights: 0, city: "" }],
    activities,
    transfers: transfers.length
      ? transfers
      : [{ name: "As per day itinerary", vehicle: "—", pickup: "—", drop: "—", notes: "", type: "Private" }],
    flights: [],
    pricing: {
      currency,
      rows: [
        { label: "Hotels", amount: pricing.hotelCost },
        { label: "Activities", amount: pricing.activityCost },
        { label: "Transfers", amount: pricing.transferCost },
        { label: "Meals", amount: pricing.mealCost ?? 0 },
        { label: "Miscellaneous", amount: pricing.miscCost ?? 0 },
        { label: "Subtotal", amount: pricing.packageBase },
        { label: "Markup", amount: pricing.markup },
        { label: "Discount", amount: -Math.abs(pricing.discount) },
        { label: "Taxes", amount: pricing.tax },
        { label: "Grand Total", amount: pricing.total, emphasis: true },
      ],
      total: pricing.total,
    },
    inclusions: snapshot.terms.inclusions,
    exclusions: snapshot.terms.exclusions,
    visaRequired: Boolean(snapshot.terms.visaRequired),
    visaDetails: snapshot.terms.visaDetails,
    termsText: snapshot.terms.termsText,
    cancellationText: snapshot.terms.cancellationText,
    notes: str(input.notes ?? "", "").trim() || "Please review all details carefully before confirming.",
    contact: { name: "Travel Consultant", designation: "Sales Executive", phone: "", email: "" },
    customHtml: "",
  };
}

function buildPackageDocumentContent(input: PdfRenderInput): PdfDocumentContent {
  const snapshot = input.snapshot;
  const pkg = (snapshot.package ?? {}) as Record<string, unknown>;
  const req = (snapshot.requirement ?? null) as Record<string, unknown> | null;
  const destination = (snapshot.destination ?? null) as Record<string, unknown> | null;

  const days: PdfItineraryDay[] = asArray(pkg.days).map((raw) => {
    const d = raw as Record<string, unknown>;
    const items: PdfItineraryItem[] = asArray(d.items).map((itemRaw) => {
      const item = itemRaw as Record<string, unknown>;
      const time = str(item.startTime ?? item.time);
      return {
        time,
        title: str(item.title, "Activity"),
        description: str(item.description),
        period: classifyPeriod(time),
      };
    });
    return {
      dayNumber: num(d.dayNumber, 1),
      title: str(d.title, `Day ${num(d.dayNumber, 1)}`),
      items,
    };
  });

  const hotels: PdfHotel[] = asArray(pkg.hotels).map((raw) => {
    const row = raw as Record<string, unknown>;
    const hp = (row.hotelProduct ?? {}) as Record<string, unknown>;
    return {
      name: str(hp.name, "Hotel"),
      category: str(
        snapshot.productSelections.hotelOptionGroup ??
          (hp.starCategory != null ? `${hp.starCategory}★` : null),
        "Standard"
      ),
      description: str(hp.description, "Comfortable stay as per package selection."),
      amenities: stringList(hp.amenities).slice(0, 12),
      image: firstImage(hp.images),
      nights: num(pkg.durationNights, 0),
      city: str(hp.city ?? destination?.name, ""),
    };
  });

  const activities: PdfActivity[] = asArray(pkg.activities).map((raw) => {
    const row = raw as Record<string, unknown>;
    const ap = (row.activityProduct ?? {}) as Record<string, unknown>;
    return {
      name: str(ap.name, "Activity"),
      description: str(ap.description, "Experience as per itinerary."),
      duration: str(ap.duration, "—"),
      image: firstImage(ap.images),
      location: str(ap.location ?? ap.meetingPoint, ""),
    };
  });

  const transfers: PdfTransfer[] = asArray(pkg.transfers).map((raw) => {
    const row = raw as Record<string, unknown>;
    const tp = (row.transferProduct ?? {}) as Record<string, unknown>;
    return {
      name: str(tp.name, "Transfer"),
      vehicle: str(tp.vehicleType, "Vehicle as assigned"),
      pickup: str(tp.pickupLocation, "Pickup as per itinerary"),
      drop: str(tp.dropLocation, "Drop as per itinerary"),
      notes: str(row.notes ?? tp.cancellationPolicy, ""),
      type: str(
        snapshot.productSelections.transferOptionGroup ?? tp.transferType,
        "Private"
      ),
    };
  });

  if (!transfers.length) {
    transfers.push({
      name: "Airport Transfers",
      vehicle: "As per selection",
      pickup: "Airport / Hotel",
      drop: "Hotel / Airport",
      notes: "As per itinerary",
      type: str(snapshot.productSelections.transferOptionGroup, "Private"),
    });
  }

  const adults = num(req?.adults, 1);
  const children = num(req?.children, 0);
  const paxLabel = `${adults} Adult${adults === 1 ? "" : "s"}${children ? ` + ${children} Child${children === 1 ? "" : "ren"}` : ""}`;

  const currency = str(snapshot.pricing.currency, "INR");
  const pricingRows = [
    { label: "Hotels", amount: snapshot.pricing.hotelCost },
    { label: "Activities", amount: snapshot.pricing.activityCost },
    { label: "Transfers", amount: snapshot.pricing.transferCost },
    { label: "Package Base", amount: snapshot.pricing.packageBase },
    { label: "Markup", amount: snapshot.pricing.markup },
    { label: "Discount", amount: -Math.abs(snapshot.pricing.discount) },
    { label: "Taxes", amount: snapshot.pricing.tax },
    { label: "Grand Total", amount: snapshot.pricing.total, emphasis: true },
  ];

  const highlights = asArray(pkg.highlights).map((h) => str(h)).filter(Boolean);
  const notes = str(input.notes ?? "", "").trim() || "Please review all details carefully before confirming.";

  return {
    proposalNumber: input.proposalNumber,
    proposalTitle: str(pkg.packageName, "Travel Proposal"),
    customerName: customerName(snapshot),
    customerEmail: str(snapshot.customer?.email ?? snapshot.lead?.email),
    customerPhone: str(snapshot.customer?.phone ?? snapshot.lead?.phone),
    paxLabel,
    destination: str(destination?.name, "Destination"),
    travelDates: req
      ? `${formatDate(req.travelStartDate as string)} – ${formatDate(req.travelEndDate as string)}`
      : "Dates to be confirmed",
    duration: `${num(pkg.durationDays, 0)} Days / ${num(pkg.durationNights, 0)} Nights`,
    generatedDate: formatDate(new Date()),
    validUntil: formatDate(input.validUntil),
    heroImage:
      str(pkg.heroImage) ||
      str(destination?.heroImage) ||
      str(destination?.thumbnail) ||
      null,
    highlights: highlights.length ? highlights : snapshot.terms.inclusions,
    days,
    hotels: hotels.length
      ? hotels
      : [
          {
            name: "Hotel as per selection",
            category: str(snapshot.productSelections.hotelOptionGroup, "Standard"),
            description: "Accommodation details will be confirmed with the final booking.",
            amenities: [],
            image: null,
            nights: num(pkg.durationNights, 0),
            city: str(destination?.name),
          },
        ],
    activities,
    transfers,
    flights: [],
    pricing: {
      currency,
      rows: pricingRows,
      total: snapshot.pricing.total,
    },
    inclusions: snapshot.terms.inclusions,
    exclusions: snapshot.terms.exclusions,
    visaRequired: Boolean(snapshot.terms.visaRequired),
    visaDetails: snapshot.terms.visaDetails,
    termsText: snapshot.terms.termsText,
    cancellationText: snapshot.terms.cancellationText,
    notes,
    contact: {
      name: "Travel Consultant",
      designation: "Sales Executive",
      phone: "",
      email: "",
    },
    customHtml: "",
  };
}
