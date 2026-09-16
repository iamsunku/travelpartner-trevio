import type { Module } from "./permissions.js";
import { db } from "./db.js";
import {
  CATALOGUE_INVENTORY_UNAVAILABLE,
  checkCatalogueHotelInventory,
  hotelLineRequiresCatalogueInventory,
} from "./hotel-inventory.js";

function isAgentLike(role?: string): boolean {
  return role === "travel_agent" || role === "customer";
}

export const PRODUCT_TYPES = ["HOTEL", "TRANSFER", "ACTIVITY", "MEAL", "FLIGHT"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const RATE_SOURCES = {
  CONTRACTED_PRODUCT: "CONTRACTED_PRODUCT",
  API: "API",
  AMADEUS_API: "AMADEUS_API",
  MOCK: "MOCK",
  MANUAL: "MANUAL",
} as const;

export type RateSource = (typeof RATE_SOURCES)[keyof typeof RATE_SOURCES];

export const NO_VALID_RATE_MESSAGE =
  "No valid contracted rate available for selected travel date.";

export const AMBIGUOUS_RATE_MESSAGE =
  "More than one contracted rate matches this travel date. Narrow the product variant so a single rate applies.";

export const OVERLAP_RATE_MESSAGE =
  "Active contracted rates for this product overlap. Adjust the validity period so each date has one rate.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VARIANT_FIELDS = ["roomType", "mealPlan", "vehicleType", "ticketType", "cabinClass", "transferType"] as const;

export type RateWindow = {
  id: string;
  contractedCost: number;
  currency: string;
  rateUnit?: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  metadata?: unknown;
};

export type RateSnapshot = {
  productType: ProductType;
  productId: string;
  rateId: string;
  contractedCost: number;
  currency: string;
  rateUnit?: string;
  validFrom: string;
  validTo: string;
  travelDate: string;
  selectedAt: string;
  source: typeof RATE_SOURCES.CONTRACTED_PRODUCT;
  frozen: true;
};

export type ApplicableRateResult =
  | { status: "OK"; rate: RateWindow }
  | { status: "NO_VALID_RATE"; message: string }
  | { status: "AMBIGUOUS_RATE"; message: string };

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value);
}

export function moduleForProductType(type: ProductType): Module {
  if (type === "HOTEL") return "hotels";
  if (type === "TRANSFER") return "transfers";
  if (type === "FLIGHT") return "flights";
  return "activities";
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateInRange(travelDate: string, validFrom: string, validTo: string): boolean {
  return travelDate >= validFrom && travelDate <= validTo;
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function rateVariantKey(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const source = metadata as Record<string, unknown>;
  const parts: string[] = [];
  for (const field of VARIANT_FIELDS) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) {
      parts.push(`${field}=${value.trim().toLowerCase()}`);
    }
  }
  return parts.join("|");
}

export function findOverlap(
  existing: RateWindow[],
  candidate: { id?: string; validFrom: string; validTo: string; metadata?: unknown; active?: boolean },
): RateWindow | null {
  if (candidate.active === false) return null;
  const variant = rateVariantKey(candidate.metadata);
  for (const rate of existing) {
    if (!rate.active || rate.id === candidate.id) continue;
    if (rateVariantKey(rate.metadata) !== variant) continue;
    if (rangesOverlap(rate.validFrom, rate.validTo, candidate.validFrom, candidate.validTo)) return rate;
  }
  return null;
}

function coveringRates(rates: RateWindow[], travelDate: string, variantKey?: string): RateWindow[] {
  return rates.filter((rate) => {
    if (!rate.active) return false;
    if (!dateInRange(travelDate, rate.validFrom, rate.validTo)) return false;
    if (variantKey == null) return true;
    return rateVariantKey(rate.metadata) === variantKey;
  });
}

/**
 * PRODUCT + active contracted rate + inclusive validity determines cost.
 * Never returns an expired, future, inactive, or invented rate.
 */
export function findApplicableContractedRate(
  rates: RateWindow[],
  travelDate: string,
  variantKey?: string,
): ApplicableRateResult {
  if (!isIsoDate(travelDate)) {
    return { status: "NO_VALID_RATE", message: NO_VALID_RATE_MESSAGE };
  }

  if (variantKey) {
    const exact = coveringRates(rates, travelDate, variantKey);
    if (exact.length === 1) return { status: "OK", rate: exact[0] };
    if (exact.length > 1) return { status: "AMBIGUOUS_RATE", message: AMBIGUOUS_RATE_MESSAGE };
    const productLevel = coveringRates(rates, travelDate, "");
    if (productLevel.length === 1) return { status: "OK", rate: productLevel[0] };
    if (productLevel.length > 1) return { status: "AMBIGUOUS_RATE", message: AMBIGUOUS_RATE_MESSAGE };
    return { status: "NO_VALID_RATE", message: NO_VALID_RATE_MESSAGE };
  }

  const matches = coveringRates(rates, travelDate);
  if (matches.length === 0) return { status: "NO_VALID_RATE", message: NO_VALID_RATE_MESSAGE };
  if (matches.length > 1) return { status: "AMBIGUOUS_RATE", message: AMBIGUOUS_RATE_MESSAGE };
  return { status: "OK", rate: matches[0] };
}

export function canViewContractedCost(role?: string): boolean {
  return !isAgentLike(role);
}

export function canManageContractedRates(role?: string): boolean {
  return !isAgentLike(role);
}

export function presentApplicableRate(
  result: ApplicableRateResult,
  role: string | undefined,
  extra: { productType: ProductType; productId: string; displayPrice?: number | null },
) {
  if (result.status !== "OK") {
    return {
      applicable: false,
      reason: result.status,
      message: result.message,
      productType: extra.productType,
      productId: extra.productId,
      source: RATE_SOURCES.CONTRACTED_PRODUCT,
    };
  }
  const payload: Record<string, unknown> = {
    applicable: true,
    productType: extra.productType,
    productId: extra.productId,
    rateId: result.rate.id,
    currency: result.rate.currency,
    validFrom: result.rate.validFrom,
    validTo: result.rate.validTo,
    source: RATE_SOURCES.CONTRACTED_PRODUCT,
    displayPrice: extra.displayPrice ?? null,
  };
  if (canViewContractedCost(role)) payload.contractedCost = result.rate.contractedCost;
  return payload;
}

export function buildRateSnapshot(input: {
  productType: ProductType;
  productId: string;
  rate: RateWindow;
  travelDate: string;
  selectedAt?: string;
}): RateSnapshot {
  return {
    productType: input.productType,
    productId: input.productId,
    rateId: input.rate.id,
    contractedCost: input.rate.contractedCost,
    currency: input.rate.currency,
    rateUnit: input.rate.rateUnit,
    validFrom: input.rate.validFrom,
    validTo: input.rate.validTo,
    travelDate: input.travelDate,
    selectedAt: input.selectedAt || new Date().toISOString(),
    source: RATE_SOURCES.CONTRACTED_PRODUCT,
    frozen: true,
  };
}

const LINE_COLLECTIONS = ["hotels", "flights", "transfers", "activities", "meals"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function snapshotOf(line: Record<string, unknown>): RateSnapshot | null {
  const snap = asRecord(line.rateSnapshot);
  if (!snap || snap.frozen !== true || typeof snap.rateId !== "string") return null;
  if (typeof snap.contractedCost !== "number" || typeof snap.productId !== "string") return null;
  return snap as unknown as RateSnapshot;
}

export function snapshotKey(snapshot: { productId?: string; rateId?: string; selectedAt?: string }): string {
  return `${snapshot.productId || ""}:${snapshot.rateId || ""}:${snapshot.selectedAt || ""}`;
}

export function indexFrozenSnapshots(packages: Array<Record<string, unknown>> | undefined): Map<string, RateSnapshot> {
  const found = new Map<string, RateSnapshot>();
  if (!packages) return found;
  for (const pkg of packages) {
    for (const key of LINE_COLLECTIONS) {
      const lines = Array.isArray(pkg[key]) ? pkg[key] : [];
      for (const raw of lines) {
        const line = asRecord(raw);
        if (!line) continue;
        const snap = snapshotOf(line);
        if (snap) found.set(snapshotKey(snap), snap);
      }
    }
  }
  return found;
}

export function lineTravelDate(line: Record<string, unknown>, fallback?: string | null): string | null {
  const candidates = [line.checkIn, line.date, line.travelDate, fallback];
  for (const value of candidates) {
    if (isIsoDate(value)) return value;
  }
  return null;
}

/** Keep the stored quotation snapshot even if the catalogue rate is later edited. */
export function preservedSnapshotCost(
  existing: RateSnapshot | undefined,
  incoming: Record<string, unknown>,
  travelDate: string | null,
): RateSnapshot | null {
  if (!existing || !travelDate) return null;
  if (existing.travelDate !== travelDate) return null;
  if (String(incoming.productId || "") !== existing.productId) return null;
  const incomingSnap = snapshotOf(incoming);
  if (!incomingSnap) return null;
  if (incomingSnap.rateId !== existing.rateId || incomingSnap.selectedAt !== existing.selectedAt) return null;
  return existing;
}

export function applyResolvedSnapshot(
  line: Record<string, unknown>,
  snapshot: RateSnapshot,
  displayPrice?: number | null,
): Record<string, unknown> {
  const selling = Number(line.sellingPrice ?? 0);
  const next: Record<string, unknown> = {
    ...line,
    source: RATE_SOURCES.CONTRACTED_PRODUCT,
    productId: snapshot.productId,
    productType: snapshot.productType,
    rateId: snapshot.rateId,
    rateSnapshot: snapshot,
    rateValidFrom: snapshot.validFrom,
    rateValidTo: snapshot.validTo,
    rateSelectedAt: snapshot.selectedAt,
    rateTravelDate: snapshot.travelDate,
    rateUnresolved: false,
    rateUnresolvedReason: null,
    costPrice: snapshot.contractedCost,
    contractedCost: snapshot.contractedCost,
  };
  if (!selling && displayPrice) next.sellingPrice = displayPrice;
  else if (!selling) next.sellingPrice = snapshot.contractedCost;
  return next;
}

export function applyUnresolvedLine(line: Record<string, unknown>, travelDate: string | null, reason = NO_VALID_RATE_MESSAGE): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...line,
    source: RATE_SOURCES.CONTRACTED_PRODUCT,
    rateUnresolved: true,
    rateUnresolvedReason: reason,
    rateTravelDate: travelDate,
    rateSnapshot: null,
    rateId: null,
  };
  delete next.costPrice;
  delete next.contractedCost;
  delete next.quotedCostPrice;
  delete next.adultRate;
  delete next.childRate;
  return next;
}

export function quoteUnresolvedRateReason(packages: Array<Record<string, unknown>> | undefined): string | null {
  if (!packages) return null;
  for (const pkg of packages) {
    for (const key of LINE_COLLECTIONS) {
      const lines = Array.isArray(pkg[key]) ? pkg[key] : [];
      for (const raw of lines) {
        const line = asRecord(raw);
        if (line?.rateUnresolved === true) {
          return String(line.rateUnresolvedReason || NO_VALID_RATE_MESSAGE);
        }
      }
    }
  }
  return null;
}

export function catalogDisplayPrice(product: Record<string, unknown>, type: ProductType): number {
  if (type === "HOTEL") {
    const rooms = Array.isArray(product.roomCategories) ? product.roomCategories : [];
    const first = asRecord(rooms[0]);
    const pricing = asRecord(first?.pricing) || {};
    return Number(pricing.double ?? pricing.single ?? 0) || 0;
  }
  if (type === "TRANSFER") return Number(product.privatePrice ?? product.sharedPrice ?? 0) || 0;
  if (type === "ACTIVITY" || type === "MEAL") return Number(product.adultPrice ?? 0) || 0;
  return Number(product.displayPrice ?? 0) || 0;
}

export function mealTransferBadge(inclusion: unknown): "No Transfer" | "Private Transfer" | null {
  const value = String(inclusion || "").toUpperCase();
  if (value === "NONE" || value === "NO_TRANSFER" || value === "NO TRANSFER") return "No Transfer";
  if (value === "PRIVATE" || value === "PRIVATE_TRANSFER") return "Private Transfer";
  return null;
}

type Scope = Record<string, unknown>;

export function toWindow(row: {
  id: string;
  contractedCost: number;
  currency: string;
  rateUnit?: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  metadata: unknown;
}): RateWindow {
  return {
    id: row.id,
    contractedCost: row.contractedCost,
    currency: row.currency,
    rateUnit: row.rateUnit,
    validFrom: row.validFrom,
    validTo: row.validTo,
    active: row.active,
    metadata: row.metadata,
  };
}

export async function listProductRates(productType: ProductType, productId: string, scope: Scope) {
  const rows = await db.contractedRate.findMany({
    where: { productType, productId, ...scope },
    orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toWindow);
}

export async function getApplicableContractedRate(input: {
  productType: ProductType;
  productId: string;
  travelDate: string;
  scope: Scope;
  variantKey?: string;
}) {
  const rates = await listProductRates(input.productType, input.productId, input.scope);
  return findApplicableContractedRate(rates, input.travelDate, input.variantKey);
}

export async function assertNoOverlappingRate(input: {
  productType: ProductType;
  productId: string;
  scope: Scope;
  candidate: { id?: string; validFrom: string; validTo: string; metadata?: unknown; active?: boolean };
}) {
  const rates = await listProductRates(input.productType, input.productId, input.scope);
  return findOverlap(rates, input.candidate);
}

export async function loadOwnedProduct(type: ProductType, productId: string, scope: Scope) {
  const where = { id: productId, ...scope };
  if (type === "HOTEL") return db.hotelProduct.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  if (type === "TRANSFER") return db.transferProduct.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  if (type === "ACTIVITY") return db.activityProduct.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  if (type === "MEAL") return db.mealProduct.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  return db.flightProduct.findFirst({ where }) as Promise<Record<string, unknown> | null>;
}

export async function freezePackageLines(
  pkg: Record<string, unknown>,
  options: {
    travelDate?: string | null;
    travelEndDate?: string | null;
    existingPackages?: Array<Record<string, unknown>>;
    scope: Scope;
  },
): Promise<Record<string, unknown>> {
  const frozen = indexFrozenSnapshots(options.existingPackages);
  const next: Record<string, unknown> = { ...pkg };
  for (const key of LINE_COLLECTIONS) {
    const lines = Array.isArray(pkg[key]) ? pkg[key] : [];
    const resolved: Record<string, unknown>[] = [];
    for (const raw of lines) {
      const line = asRecord(raw);
      if (!line) continue;
      resolved.push(await freezeLine(line, options.travelDate || null, options.travelEndDate || null, frozen, options.scope));
    }
    next[key] = resolved;
  }
  return next;
}

async function freezeLine(
  line: Record<string, unknown>,
  fallbackDate: string | null,
  fallbackEndDate: string | null,
  frozen: Map<string, RateSnapshot>,
  scope: Scope,
): Promise<Record<string, unknown>> {
  const source = typeof line.source === "string" ? line.source : "";
  if (
    source === RATE_SOURCES.MANUAL
    || source === RATE_SOURCES.API
    || source === RATE_SOURCES.AMADEUS_API
    || source === RATE_SOURCES.MOCK
  ) {
    const manual = { ...line };
    delete manual.contractedCost;
    return manual;
  }
  if (!line.productId || !isProductType(line.productType)) return line;

  const travelDate = lineTravelDate(line, fallbackDate);
  const incomingSnap = snapshotOf(line);
  const existing = incomingSnap ? frozen.get(snapshotKey(incomingSnap)) : undefined;
  const preserved = preservedSnapshotCost(existing, line, travelDate);
  if (preserved) return applyResolvedSnapshot(line, preserved);

  if (!travelDate) return applyUnresolvedLine(line, null);
  const variant = rateVariantKey({
    roomType: line.roomType,
    mealPlan: line.mealPlan,
    vehicleType: line.vehicleType,
    ticketType: line.ticketType,
    cabinClass: line.cabinClass,
    transferType: line.transferType,
  });
  const result = await getApplicableContractedRate({
    productType: line.productType,
    productId: String(line.productId),
    travelDate,
    scope,
    variantKey: variant || undefined,
  });
  if (result.status !== "OK") return applyUnresolvedLine(line, travelDate);
  const product = await loadOwnedProduct(line.productType, String(line.productId), scope);
  if (line.productType === "HOTEL" && hotelLineRequiresCatalogueInventory(line) && product) {
    const checkIn = isIsoDate(line.checkIn) ? String(line.checkIn) : travelDate;
    const checkOut = isIsoDate(line.checkOut)
      ? String(line.checkOut)
      : (fallbackEndDate && isIsoDate(fallbackEndDate) ? fallbackEndDate : null);
    if (checkIn && checkOut) {
      const inventory = checkCatalogueHotelInventory({
        inventory: product.inventory,
        blackoutDates: product.blackoutDates,
        checkIn,
        checkOut,
        roomType: line.roomType ? String(line.roomType) : null,
        rooms: Number(line.rooms || 1),
      });
      if (!inventory.ok) {
        return applyUnresolvedLine(line, travelDate, inventory.message || CATALOGUE_INVENTORY_UNAVAILABLE);
      }
    }
  }
  return applyResolvedSnapshot(
    line,
    buildRateSnapshot({
      productType: line.productType,
      productId: String(line.productId),
      rate: result.rate,
      travelDate,
    }),
    product ? catalogDisplayPrice(product, line.productType) : null,
  );
}
