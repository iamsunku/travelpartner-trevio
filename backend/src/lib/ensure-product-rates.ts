import { db } from "./db.js";
import { catalogDisplayPrice, type ProductType } from "./contracted-rates.js";

const DEFAULT_FROM = "2026-01-01";
const DEFAULT_TO = "2027-12-31";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hotelCostAndMeta(product: Record<string, unknown>): { cost: number; metadata: Record<string, string> } {
  const rooms = Array.isArray(product.roomCategories) ? product.roomCategories : [];
  const first = asRecord(rooms[0]);
  const pricing = asRecord(first?.pricing) || {};
  const selling = Number(pricing.double ?? pricing.single ?? 0) || catalogDisplayPrice(product, "HOTEL");
  const cost = Math.max(1, Math.round(selling > 0 ? selling * 0.75 : 10000));
  const metadata: Record<string, string> = {};
  if (typeof first?.name === "string" && first.name.trim()) metadata.roomType = first.name.trim();
  if (typeof first?.mealPlan === "string" && first.mealPlan.trim()) metadata.mealPlan = first.mealPlan.trim();
  return { cost, metadata };
}

function productCost(product: Record<string, unknown>, type: ProductType): number {
  if (type === "HOTEL") return hotelCostAndMeta(product).cost;
  const display = catalogDisplayPrice(product, type);
  if (display > 0) return Math.max(1, Math.round(display * 0.75));
  if (type === "FLIGHT") return 12000;
  if (type === "TRANSFER") return 1500;
  if (type === "ACTIVITY") return 2000;
  return 900;
}

function productMeta(product: Record<string, unknown>, type: ProductType): Record<string, string> {
  if (type === "HOTEL") return hotelCostAndMeta(product).metadata;
  const meta: Record<string, string> = {};
  if (type === "TRANSFER") {
    if (typeof product.vehicleType === "string" && product.vehicleType.trim()) meta.vehicleType = product.vehicleType.trim();
    if (typeof product.transferType === "string" && product.transferType.trim()) meta.transferType = product.transferType.trim();
  }
  if (type === "ACTIVITY" && typeof product.ticketType === "string" && product.ticketType.trim()) {
    meta.ticketType = product.ticketType.trim();
  }
  if (type === "FLIGHT" && typeof product.cabinClass === "string" && product.cabinClass.trim()) {
    meta.cabinClass = product.cabinClass.trim();
  }
  return meta;
}

const liveWhere = { status: "Active" as const, approvalStatus: "Approved" as const };

/**
 * Create a default contracted-rate window for live catalog products that have none.
 * Needed so quotation Catalog picks work when products were approved without rates.
 */
export async function backfillMissingContractedRates(opts?: {
  validFrom?: string;
  validTo?: string;
}): Promise<{ created: number; skipped: number }> {
  const validFrom = opts?.validFrom || DEFAULT_FROM;
  const validTo = opts?.validTo || DEFAULT_TO;
  let created = 0;
  let skipped = 0;

  const loaders: Array<{ type: ProductType; rows: Promise<Record<string, unknown>[]> }> = [
    { type: "HOTEL", rows: db.hotelProduct.findMany({ where: liveWhere }) as Promise<Record<string, unknown>[]> },
    { type: "TRANSFER", rows: db.transferProduct.findMany({ where: liveWhere }) as Promise<Record<string, unknown>[]> },
    { type: "ACTIVITY", rows: db.activityProduct.findMany({ where: liveWhere }) as Promise<Record<string, unknown>[]> },
    { type: "MEAL", rows: db.mealProduct.findMany({ where: liveWhere }) as Promise<Record<string, unknown>[]> },
    { type: "FLIGHT", rows: db.flightProduct.findMany({ where: liveWhere }) as Promise<Record<string, unknown>[]> },
  ];

  for (const { type, rows: rowsPromise } of loaders) {
    const products = await rowsPromise;
    for (const product of products) {
      const productId = String(product.id || "");
      if (!productId) continue;
      const existing = await db.contractedRate.count({
        where: { productType: type, productId, active: true },
      });
      if (existing > 0) {
        skipped += 1;
        continue;
      }
      await db.contractedRate.create({
        data: {
          agencyId: typeof product.agencyId === "string" ? product.agencyId : null,
          productType: type,
          productId,
          currency: String(product.currency || "INR"),
          rateUnit: type === "HOTEL" ? "PER_ROOM_NIGHT" : "UNSPECIFIED",
          contractedCost: productCost(product, type),
          validFrom,
          validTo,
          active: true,
          metadata: productMeta(product, type),
        },
      });
      created += 1;
    }
  }

  return { created, skipped };
}
