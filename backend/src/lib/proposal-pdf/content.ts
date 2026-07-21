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
