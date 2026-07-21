import { db } from "./db.js";
import { hotelProductPrice } from "./package-matching.js";

export type ProductSelections = {
  hotelOptionGroup: string | null;
  activityOptionGroup: string | null;
  transferOptionGroup: string | null;
};

export type ProposalPricing = {
  hotelCost: number;
  activityCost: number;
  transferCost: number;
  packageBase: number;
  markup: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
};

export type ProposalSnapshotData = {
  capturedAt: string;
  requirement: Record<string, unknown> | null;
  customer: Record<string, unknown> | null;
  lead: Record<string, unknown> | null;
  destination: Record<string, unknown> | null;
  package: Record<string, unknown>;
  productOptions: Record<string, unknown>[];
  productPrices: Record<string, number>;
  productSelections: ProductSelections;
  pricing: ProposalPricing;
  template: Record<string, unknown> | null;
  branding: Record<string, unknown> | null;
  terms: {
    inclusions: string[];
    exclusions: string[];
    termsText: string;
    cancellationText: string;
    visaRequired: boolean;
    visaDetails: string;
  };
};

const PACKAGE_INCLUDE = {
  destination: { select: { id: true, name: true, country: true, thumbnail: true, heroImage: true } },
  hotels: {
    orderBy: { sortOrder: "asc" as const },
    include: { hotelProduct: { include: { supplier: { select: { id: true, name: true } } } } },
  },
  activities: {
    orderBy: { sortOrder: "asc" as const },
    include: { activityProduct: { include: { supplier: { select: { id: true, name: true } } } } },
  },
  transfers: {
    orderBy: { sortOrder: "asc" as const },
    include: { transferProduct: { include: { supplier: { select: { id: true, name: true } } } } },
  },
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: { items: { orderBy: { sortOrder: "asc" as const } } },
  },
  productOptions: { orderBy: [{ productType: "asc" as const }, { optionGroup: "asc" as const }, { sortOrder: "asc" as const }] },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function resolveProductPrices(productOptions: { productType: string; productId: string }[]) {
  const hotelIds = [...new Set(productOptions.filter((o) => o.productType === "HOTEL").map((o) => o.productId))];
  const activityIds = [...new Set(productOptions.filter((o) => o.productType === "ACTIVITY").map((o) => o.productId))];
  const transferIds = [...new Set(productOptions.filter((o) => o.productType === "TRANSFER").map((o) => o.productId))];

  const [hotels, activities, transfers] = await Promise.all([
    hotelIds.length ? db.hotelProduct.findMany({ where: { id: { in: hotelIds } }, select: { id: true, roomCategories: true } }) : [],
    activityIds.length ? db.activityProduct.findMany({ where: { id: { in: activityIds } }, select: { id: true, adultPrice: true } }) : [],
    transferIds.length ? db.transferProduct.findMany({ where: { id: { in: transferIds } }, select: { id: true, privatePrice: true, sharedPrice: true } }) : [],
  ]);

  const priceMap: Record<string, number> = {};
  for (const h of hotels) priceMap[h.id] = hotelProductPrice(h.roomCategories);
  for (const a of activities) priceMap[a.id] = a.adultPrice ?? 0;
  for (const t of transfers) priceMap[t.id] = t.privatePrice ?? t.sharedPrice ?? 0;
  return priceMap;
}

export function recalcPricingFromSnapshot(
  productOptions: { productType: string; productId: string; optionGroup: string; isDefault?: boolean; priceAdjustment?: number }[],
  productPrices: Record<string, number>,
  selections: ProductSelections,
  markup: number,
  discount: number,
  tax: number,
  currency: string
): ProposalPricing {
  function pickCost(type: string, group: string | null): number {
    const typeOpts = productOptions.filter((o) => o.productType === type);
    if (!typeOpts.length) return 0;
    const g = group ?? typeOpts.find((o) => o.isDefault)?.optionGroup ?? typeOpts[0].optionGroup;
    const opt = typeOpts.find((o) => o.optionGroup === g && o.isDefault)
      ?? typeOpts.find((o) => o.optionGroup === g)
      ?? typeOpts[0];
    return (productPrices[opt.productId] ?? 0) + (opt.priceAdjustment ?? 0);
  }

  const hotelCost = pickCost("HOTEL", selections.hotelOptionGroup);
  const activityCost = pickCost("ACTIVITY", selections.activityOptionGroup);
  const transferCost = pickCost("TRANSFER", selections.transferOptionGroup);
  const packageBase = hotelCost + activityCost + transferCost;
  const subtotal = Math.max(0, packageBase + markup - discount);
  const total = Math.max(0, subtotal + tax);

  return {
    hotelCost,
    activityCost,
    transferCost,
    packageBase,
    markup,
    discount,
    tax,
    total,
    currency,
  };
}

export async function buildProposalSnapshot(input: {
  packageId: string;
  requirement?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  lead?: Record<string, unknown> | null;
  destination?: Record<string, unknown> | null;
  selections: ProductSelections;
  markup: number;
  discount?: number;
  tax?: number;
  currency?: string;
  templateId?: string | null;
  agencyId?: string | null;
}): Promise<ProposalSnapshotData> {
  const pkg = await db.travelPackage.findFirst({
    where: { id: input.packageId, deletedAt: null },
    include: PACKAGE_INCLUDE,
  });
  if (!pkg) throw new Error("Package not found");

  const productOptions = pkg.productOptions.map((o) => ({
    productType: o.productType,
    productId: o.productId,
    optionGroup: o.optionGroup,
    isDefault: o.isDefault,
    priceAdjustment: o.priceAdjustment ?? 0,
    status: o.status,
    notes: o.notes,
  }));

  const productPrices = await resolveProductPrices(productOptions);
  const currency = input.currency ?? pkg.currency ?? "INR";
  const pricing = recalcPricingFromSnapshot(
    productOptions,
    productPrices,
    input.selections,
    input.markup,
    input.discount ?? 0,
    input.tax ?? 0,
    currency
  );

  let template: Record<string, unknown> | null = null;
  if (input.templateId) {
    const t = await db.quoteTemplate.findFirst({
      where: { id: input.templateId, deletedAt: null },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
    if (t) template = clone(t);
  }
  if (!template && input.agencyId) {
    const t = await db.quoteTemplate.findFirst({
      where: { agencyId: input.agencyId, isDefault: true, status: "Active", deletedAt: null },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
    if (t) template = clone(t);
  }

  let branding: Record<string, unknown> | null = null;
  if (input.agencyId) {
    const b = await db.agencyBranding.findUnique({ where: { agencyId: input.agencyId } });
    if (b) branding = clone(b);
  }

  const highlights = Array.isArray(pkg.highlights) ? (pkg.highlights as string[]) : [];

  return {
    capturedAt: new Date().toISOString(),
    requirement: input.requirement ? clone(input.requirement) : null,
    customer: input.customer ? clone(input.customer) : null,
    lead: input.lead ? clone(input.lead) : null,
    destination: input.destination ? clone(input.destination) : clone(pkg.destination),
    package: clone(pkg),
    productOptions: clone(productOptions),
    productPrices,
    productSelections: { ...input.selections },
    pricing,
    template,
    branding,
    terms: {
      inclusions: highlights.slice(0, 6),
      exclusions: ["International flights unless specified", "Personal expenses", "Travel insurance", "Visa fees"],
      termsText: "Quote valid for the period specified. 50% advance required to confirm booking.",
      cancellationText: "30+ days: 25% charge. 15-29 days: 50% charge. Less than 15 days: 100% charge.",
      visaRequired: Boolean((input.requirement as { visaRequired?: boolean } | null)?.visaRequired),
      visaDetails: "Visa requirements vary by destination. Please verify before travel.",
    },
  };
}

export function applySnapshotEdits(
  current: ProposalSnapshotData,
  edits: {
    productSelections?: Partial<ProductSelections>;
    markup?: number;
    discount?: number;
    tax?: number;
    notes?: string;
    internalNotes?: string;
    terms?: Partial<ProposalSnapshotData["terms"]>;
  }
): ProposalSnapshotData {
  const next = clone(current);
  if (edits.productSelections) {
    next.productSelections = { ...next.productSelections, ...edits.productSelections };
  }
  const markup = edits.markup ?? next.pricing.markup;
  const discount = edits.discount ?? next.pricing.discount;
  const tax = edits.tax ?? next.pricing.tax;
  next.pricing = recalcPricingFromSnapshot(
    next.productOptions as { productType: string; productId: string; optionGroup: string; isDefault?: boolean; priceAdjustment?: number }[],
    next.productPrices,
    next.productSelections,
    markup,
    discount,
    tax,
    next.pricing.currency
  );
  if (edits.terms) next.terms = { ...next.terms, ...edits.terms };
  return next;
}
