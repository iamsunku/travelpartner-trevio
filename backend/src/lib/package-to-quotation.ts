import { db } from "./db.js";

const PACKAGE_INCLUDE = {
  destination: { select: { id: true, name: true, country: true, thumbnail: true, heroImage: true } },
  hotels: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      hotelProduct: {
        include: { supplier: { select: { id: true, name: true } }, destination: { select: { name: true } } },
      },
    },
  },
  activities: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      activityProduct: {
        include: { supplier: { select: { id: true, name: true } }, destination: { select: { name: true } } },
      },
    },
  },
  transfers: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      transferProduct: {
        include: { supplier: { select: { id: true, name: true } }, destination: { select: { name: true } } },
      },
    },
  },
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: { items: { orderBy: { sortOrder: "asc" as const } } },
  },
} as const;

type LoadedPackage = NonNullable<Awaited<ReturnType<typeof loadPublishedPackage>>>;

export async function loadPublishedPackage(packageId: string, agencyId?: string | null) {
  return db.travelPackage.findFirst({
    where: {
      id: packageId,
      deletedAt: null,
      status: "Published",
      ...(agencyId ? { agencyId } : {}),
    },
    include: PACKAGE_INCLUDE,
  });
}

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function firstImage(product: { images?: unknown }) {
  if (Array.isArray(product.images) && product.images.length) return String(product.images[0]);
  return "";
}

export function buildQuotationPackageFromTravelPackage(pkg: LoadedPackage) {
  const hotels = pkg.hotels.map((link) => {
    const h = link.hotelProduct;
    return {
      hotelName: h.name,
      city: h.city || pkg.destination?.name || "",
      starCategory: h.starCategory,
      roomType: "Standard",
      mealPlan: "Breakfast",
      nights: pkg.durationNights,
      imageUrl: firstImage(h),
      sellingPrice: Math.round((pkg.hotelCost || 0) / Math.max(pkg.hotels.length, 1)),
      costPrice: Math.round((pkg.hotelCost || 0) / Math.max(pkg.hotels.length, 1)),
      supplier: h.supplier?.name,
      supplierId: h.supplierId,
    };
  });

  const activities = pkg.activities.map((link) => {
    const a = link.activityProduct;
    return {
      activityName: a.name,
      description: a.description || a.name,
      ticketType: "Standard",
      imageUrl: firstImage(a),
      sellingPrice: Math.round((pkg.activityCost || 0) / Math.max(pkg.activities.length, 1)),
      costPrice: Math.round((pkg.activityCost || 0) / Math.max(pkg.activities.length, 1)),
      supplier: a.supplier?.name,
      supplierId: a.supplierId,
    };
  });

  const transfers = pkg.transfers.map((link) => {
    const t = link.transferProduct;
    return {
      transferType: t.transferType || t.vehicleType || "Transfer",
      vehicleType: t.vehicleType,
      from: t.pickupLocation || pkg.destination?.name || "",
      to: t.dropLocation || "",
      sellingPrice: Math.round((pkg.transferCost || 0) / Math.max(pkg.transfers.length, 1)),
      costPrice: Math.round((pkg.transferCost || 0) / Math.max(pkg.transfers.length, 1)),
      supplier: t.supplier?.name,
      supplierId: t.supplierId,
    };
  });

  const itinerary = (pkg.days || []).map((day) => ({
    day: day.dayNumber,
    title: day.title,
    city: pkg.destination?.name,
    coverImage: day.coverImage,
    gallery: day.gallery,
    mealPlan: day.mealPlan,
    items: (day.items || []).map((item) => ({
      activityName: item.title,
      description: item.description || item.title,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  }));

  const highlights = Array.isArray(pkg.highlights) ? (pkg.highlights as string[]) : [];
  const inclusions = highlights.length
    ? highlights
    : ["Accommodation", "Sightseeing", "Transfers as per itinerary"];
  const exclusions = ["Personal expenses", "Meals not mentioned", "Travel insurance unless specified"];

  const baseCost = pkg.hotelCost + pkg.activityCost + pkg.transferCost;
  const baseSelling = pkg.finalPrice || baseCost + pkg.markup + (pkg.tax || 0) - pkg.discount;
  // Never invent GST @ 18%. Package.tax is catalogue metadata only; Phase 3 TaxRule applies on quote save.
  const gst = pkg.tax != null ? Math.round(Number(pkg.tax)) : 0;

  return {
    packagePayload: {
      name: pkg.packageName,
      sortOrder: 0,
      isSelected: true,
      description: pkg.description || `${pkg.durationNights}N / ${pkg.durationDays}D`,
      hotels,
      flights: [],
      transfers,
      activities,
      meals: [],
      itinerary,
      addOns: [],
      inclusions,
      exclusions,
      totalNetCost: baseCost,
      totalSelling: baseSelling,
      grossProfit: Math.max(0, baseSelling - baseCost),
      gst,
      total: baseSelling,
      perPersonCost: baseSelling,
    },
    meta: {
      destination: pkg.destination?.name || "",
      country: pkg.destination?.country || "",
      coverImage: pkg.heroImage || pkg.bannerImage || pkg.destination?.heroImage || null,
      nights: pkg.durationNights,
      days: pkg.durationDays,
      currency: pkg.currency || "INR",
      baseSellingTotal: baseSelling,
      packageIncludes: inclusions,
      packageExcludes: exclusions,
    },
  };
}

export function totalsWithAgentMarkup(baseSellingTotal: number, agentMarkup: number, adults = 2, children = 0) {
  const markup = Math.max(0, Math.round(agentMarkup));
  const base = Math.max(0, Math.round(baseSellingTotal));
  const total = base + markup;
  const pax = Math.max(1, adults + children);
  return {
    agentMarkup: markup,
    baseSellingTotal: base,
    amount: total,
    gst: 0,
    total,
    perPersonCost: Math.round(total / pax),
    totalSelling: total,
  };
}
