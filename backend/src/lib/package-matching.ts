import { db } from "./db.js";

export type MatchInput = {
  destinationId: string;
  days: number;
  nights: number;
  budgetMin: number;
  budgetMax: number;
  hotelCategory?: string | null;
  packageType?: string | null;
  adults?: number;
};

export type PackageMatchResult = {
  packageId: string;
  score: number;
  reasons: string[];
  package: Record<string, unknown>;
};

const HOTEL_CATEGORY_MAP: Record<string, string[]> = {
  "3-star": ["Standard", "Budget"],
  "4-star": ["Premium", "Standard"],
  "5-star": ["Luxury", "Premium"],
  Standard: ["Standard"],
  Premium: ["Premium"],
  Luxury: ["Luxury"],
  Budget: ["Standard", "Budget"],
};

function hotelCategoryScore(pkgHotelGroups: string[], reqCategory?: string | null): { points: number; reason?: string } {
  if (!reqCategory) return { points: 3, reason: "Hotel category not specified" };
  const preferred = HOTEL_CATEGORY_MAP[reqCategory] ?? [reqCategory];
  const hit = preferred.some((g) => pkgHotelGroups.includes(g));
  if (hit) return { points: 5, reason: `Hotel tier matches (${reqCategory})` };
  if (pkgHotelGroups.length) return { points: 2, reason: "Hotel options available (tier differs)" };
  return { points: 0, reason: "No hotel options configured" };
}

function durationScore(pkgDays: number, reqDays: number): { points: number; reason: string } {
  const diff = Math.abs(pkgDays - reqDays);
  if (diff === 0) return { points: 25, reason: `Duration exact match (${reqDays} days)` };
  if (diff === 1) return { points: 20, reason: `Duration close (${pkgDays}D vs ${reqDays}D requested)` };
  if (diff === 2) return { points: 12, reason: `Duration within 2 days (${pkgDays}D vs ${reqDays}D)` };
  if (diff <= 3) return { points: 6, reason: `Duration differs by ${diff} days` };
  return { points: 0, reason: `Duration mismatch (${pkgDays}D vs ${reqDays}D)` };
}

function budgetScore(price: number, min: number, max: number): { points: number; reason: string } {
  if (max <= 0 && min <= 0) return { points: 15, reason: "Budget not specified" };
  const ceiling = max > 0 ? max : min * 2;
  const floor = min > 0 ? min : 0;
  if (price >= floor && price <= ceiling) return { points: 20, reason: "Within budget range" };
  if (price <= ceiling * 1.15) return { points: 12, reason: "Slightly above budget (+15%)" };
  if (price <= ceiling * 1.3) return { points: 6, reason: "Above budget (+30%)" };
  if (price < floor) return { points: 10, reason: "Below minimum budget" };
  return { points: 0, reason: "Outside budget range" };
}

function packageTypeScore(pkgType: string, reqType?: string | null): { points: number; reason?: string } {
  if (!reqType) return { points: 5, reason: "Package type not specified" };
  if (pkgType.toLowerCase() === reqType.toLowerCase()) return { points: 10, reason: `Package type matches (${reqType})` };
  return { points: 3, reason: `Package type: ${pkgType} (requested ${reqType})` };
}

export async function matchPackages(input: MatchInput, agencyScope: Record<string, unknown>, limit = 12): Promise<PackageMatchResult[]> {
  const packages = await db.travelPackage.findMany({
    where: {
      ...agencyScope,
      deletedAt: null,
      status: "Published",
      destinationId: input.destinationId,
    },
    include: {
      destination: { select: { id: true, name: true, country: true, thumbnail: true } },
      productOptions: { where: { status: "Active" } },
      _count: { select: { hotels: true, activities: true } },
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  const results: PackageMatchResult[] = [];

  for (const pkg of packages) {
    const reasons: string[] = [];
    let score = 0;

    score += 40;
    reasons.push(`Same destination (${pkg.destination?.name ?? "match"})`);

    const dur = durationScore(pkg.durationDays, input.days);
    score += dur.points;
    reasons.push(dur.reason);

    const budget = budgetScore(pkg.finalPrice ?? pkg.startingPrice, input.budgetMin, input.budgetMax);
    score += budget.points;
    reasons.push(budget.reason);

    const pType = packageTypeScore(pkg.packageType, input.packageType);
    score += pType.points;
    if (pType.reason) reasons.push(pType.reason);

    const hotelGroups = [...new Set(pkg.productOptions.filter((o) => o.productType === "HOTEL").map((o) => o.optionGroup))];
    const hCat = hotelCategoryScore(hotelGroups, input.hotelCategory);
    score += hCat.points;
    if (hCat.reason) reasons.push(hCat.reason);

    if (pkg._count.hotels < 1 || pkg._count.activities < 1) {
      score = Math.max(0, score - 15);
      reasons.push("Missing hotels or activities");
    }

    if (pkg.status !== "Published") {
      score = Math.max(0, score - 20);
    }

    score = Math.min(100, Math.round(score));

    results.push({
      packageId: pkg.id,
      score,
      reasons,
      package: {
        id: pkg.id,
        packageCode: pkg.packageCode,
        packageName: pkg.packageName,
        destination: pkg.destination,
        durationDays: pkg.durationDays,
        durationNights: pkg.durationNights,
        packageType: pkg.packageType,
        startingPrice: pkg.startingPrice,
        finalPrice: pkg.finalPrice,
        currency: pkg.currency,
        heroImage: pkg.heroImage,
        bannerImage: pkg.bannerImage,
        hotelOptionGroups: hotelGroups,
        activityOptionGroups: [...new Set(pkg.productOptions.filter((o) => o.productType === "ACTIVITY").map((o) => o.optionGroup))],
        transferOptionGroups: [...new Set(pkg.productOptions.filter((o) => o.productType === "TRANSFER").map((o) => o.optionGroup))],
      },
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function hotelProductPrice(roomCategories: unknown): number {
  const rooms = Array.isArray(roomCategories) ? (roomCategories as Record<string, unknown>[]) : [];
  const pricing = (rooms[0]?.pricing as Record<string, number>) ?? {};
  return pricing.double ?? pricing.single ?? 0;
}

type OptionRow = {
  productType: string;
  productId: string;
  optionGroup: string;
  isDefault?: boolean;
  priceAdjustment?: number;
  status?: string;
};

export async function calcPriceFromGroups(
  packageId: string,
  groups: { hotelOptionGroup?: string | null; activityOptionGroup?: string | null; transferOptionGroup?: string | null },
  markup = 0
) {
  const options = await db.packageProductOption.findMany({
    where: { packageId, status: "Active" },
  });

  const hotelIds = [...new Set(options.filter((o) => o.productType === "HOTEL").map((o) => o.productId))];
  const activityIds = [...new Set(options.filter((o) => o.productType === "ACTIVITY").map((o) => o.productId))];
  const transferIds = [...new Set(options.filter((o) => o.productType === "TRANSFER").map((o) => o.productId))];

  const [hotels, activities, transfers] = await Promise.all([
    hotelIds.length ? db.hotelProduct.findMany({ where: { id: { in: hotelIds } }, select: { id: true, roomCategories: true } }) : [],
    activityIds.length ? db.activityProduct.findMany({ where: { id: { in: activityIds } }, select: { id: true, adultPrice: true } }) : [],
    transferIds.length ? db.transferProduct.findMany({ where: { id: { in: transferIds } }, select: { id: true, privatePrice: true, sharedPrice: true } }) : [],
  ]);

  const priceMap = new Map<string, number>();
  for (const h of hotels) priceMap.set(h.id, hotelProductPrice(h.roomCategories));
  for (const a of activities) priceMap.set(a.id, a.adultPrice ?? 0);
  for (const t of transfers) priceMap.set(t.id, t.privatePrice ?? t.sharedPrice ?? 0);

  function pickCost(type: string, group?: string | null): number {
    const typeOpts = options.filter((o) => o.productType === type);
    if (!typeOpts.length) return 0;
    const g = group ?? typeOpts.find((o) => o.isDefault)?.optionGroup ?? typeOpts[0].optionGroup;
    const opt = typeOpts.find((o) => o.optionGroup === g && o.isDefault)
      ?? typeOpts.find((o) => o.optionGroup === g)
      ?? typeOpts[0];
    return (priceMap.get(opt.productId) ?? 0) + (opt.priceAdjustment ?? 0);
  }

  const hotelCost = pickCost("HOTEL", groups.hotelOptionGroup);
  const activityCost = pickCost("ACTIVITY", groups.activityOptionGroup);
  const transferCost = pickCost("TRANSFER", groups.transferOptionGroup);
  const packageBase = hotelCost + activityCost + transferCost;
  const sellingPrice = Math.max(0, packageBase + markup);

  return {
    hotelCost,
    activityCost,
    transferCost,
    packageBase,
    markup,
    sellingPrice,
    groups: {
      hotelOptionGroup: groups.hotelOptionGroup ?? null,
      activityOptionGroup: groups.activityOptionGroup ?? null,
      transferOptionGroup: groups.transferOptionGroup ?? null,
    },
  };
}

export function defaultGroupsFromOptions(options: OptionRow[]) {
  const pick = (type: string) => {
    const opts = options.filter((o) => o.productType === type && o.status !== "Inactive");
    if (!opts.length) return null;
    const def = opts.find((o) => o.isDefault);
    return def?.optionGroup ?? opts[0].optionGroup;
  };
  return {
    hotelOptionGroup: pick("HOTEL"),
    activityOptionGroup: pick("ACTIVITY"),
    transferOptionGroup: pick("TRANSFER"),
  };
}
