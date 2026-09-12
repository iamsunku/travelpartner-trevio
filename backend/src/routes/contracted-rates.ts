import type { Express, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requireCrudPermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  OVERLAP_RATE_MESSAGE,
  assertNoOverlappingRate,
  canManageContractedRates,
  canViewContractedCost,
  catalogDisplayPrice,
  getApplicableContractedRate,
  isIsoDate,
  isProductType,
  listProductRates,
  loadOwnedProduct,
  moduleForProductType,
  presentApplicableRate,
  rateVariantKey,
  type ProductType,
} from "../lib/contracted-rates.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : String(id ?? "");
}

function denyAgent(req: AuthRequest, res: Response): boolean {
  if (!canManageContractedRates(req.auth?.role) || !canViewContractedCost(req.auth?.role)) {
    res.status(403).json({ error: "Forbidden" });
    return true;
  }
  return false;
}

function readVariant(source: Record<string, unknown>) {
  return rateVariantKey({
    roomType: source.roomType,
    mealPlan: source.mealPlan,
    vehicleType: source.vehicleType,
    ticketType: source.ticketType,
    cabinClass: source.cabinClass,
    transferType: source.transferType,
  });
}

export function mountContractedRateRoutes(app: Express, agencyScope: ScopeFn) {
  app.get("/api/contracted-rates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (denyAgent(req, res)) return;
      if (!isProductType(req.query.productType) || !req.query.productId) {
        res.status(400).json({ error: "productType and productId are required" });
        return;
      }
      const productType = req.query.productType;
      const gate = requireCrudPermission(moduleForProductType(productType), "view");
      gate(req, res, async () => {
        const product = await loadOwnedProduct(productType, String(req.query.productId), agencyScope(req));
        if (!product) {
          res.status(404).json({ error: "Product not found" });
          return;
        }
        const rates = await listProductRates(productType, String(req.query.productId), agencyScope(req));
        res.json({ rates, productType, productId: String(req.query.productId) });
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/contracted-rates/applicable", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!isProductType(req.query.productType) || !req.query.productId || !isIsoDate(req.query.travelDate)) {
        res.status(400).json({ error: "productType, productId, and travelDate (YYYY-MM-DD) are required" });
        return;
      }
      const productType = req.query.productType as ProductType;
      const gate = requireCrudPermission(moduleForProductType(productType), "view");
      gate(req, res, async () => {
        const product = await loadOwnedProduct(productType, String(req.query.productId), agencyScope(req));
        if (!product || product.status === "Archived") {
          res.status(404).json({ error: "Product not found" });
          return;
        }
        const variant = readVariant(req.query as Record<string, unknown>);
        const result = await getApplicableContractedRate({
          productType,
          productId: String(req.query.productId),
          travelDate: String(req.query.travelDate),
          scope: agencyScope(req),
          variantKey: variant || undefined,
        });
        res.json(presentApplicableRate(result, req.auth?.role, {
          productType,
          productId: String(req.query.productId),
          displayPrice: catalogDisplayPrice(product, productType),
        }));
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/contracted-rates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (denyAgent(req, res)) return;
      const body = req.body || {};
      if (!isProductType(body.productType) || !body.productId) {
        res.status(400).json({ error: "productType and productId are required" });
        return;
      }
      const productType = body.productType as ProductType;
      const gate = requireCrudPermission(moduleForProductType(productType), "edit");
      gate(req, res, async () => {
        const error = await validateRateWrite(body, agencyScope(req));
        if (error) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        const overlap = await assertNoOverlappingRate({
          productType,
          productId: String(body.productId),
          scope: agencyScope(req),
          candidate: body,
        });
        if (overlap) {
          res.status(409).json({ error: OVERLAP_RATE_MESSAGE });
          return;
        }
        const rate = await db.contractedRate.create({
          data: {
            agencyId: req.auth?.agencyId,
            productType,
            productId: String(body.productId),
            currency: String(body.currency || "INR"),
            rateUnit: typeof body.rateUnit === "string" ? body.rateUnit : "UNSPECIFIED",
            contractedCost: Math.round(Number(body.contractedCost)),
            validFrom: String(body.validFrom),
            validTo: String(body.validTo),
            active: body.active !== false,
            metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
            createdById: req.auth?.userId,
            updatedById: req.auth?.userId,
          },
        });
        res.status(201).json({ rate });
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/contracted-rates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (denyAgent(req, res)) return;
      const existing = await db.contractedRate.findFirst({
        where: { id: paramId(req), ...agencyScope(req) },
      });
      if (!existing || !isProductType(existing.productType)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const productType = existing.productType;
      const gate = requireCrudPermission(moduleForProductType(productType), "edit");
      gate(req, res, async () => {
        const body = req.body || {};
        const next = {
          productType,
          productId: existing.productId,
          contractedCost: body.contractedCost != null ? body.contractedCost : existing.contractedCost,
          currency: body.currency != null ? body.currency : existing.currency,
          validFrom: body.validFrom != null ? body.validFrom : existing.validFrom,
          validTo: body.validTo != null ? body.validTo : existing.validTo,
          active: body.active != null ? body.active : existing.active,
          metadata: body.metadata != null ? body.metadata : existing.metadata,
        };
        const error = await validateRateWrite(next, agencyScope(req), true);
        if (error) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        const overlap = await assertNoOverlappingRate({
          productType,
          productId: existing.productId,
          scope: agencyScope(req),
          candidate: { ...next, id: existing.id },
        });
        if (overlap) {
          res.status(409).json({ error: OVERLAP_RATE_MESSAGE });
          return;
        }
        const rate = await db.contractedRate.update({
          where: { id: existing.id },
          data: {
            currency: String(next.currency || "INR"),
            contractedCost: Math.round(Number(next.contractedCost)),
            validFrom: String(next.validFrom),
            validTo: String(next.validTo),
            active: next.active !== false,
            metadata: next.metadata && typeof next.metadata === "object" ? next.metadata : {},
            updatedById: req.auth?.userId,
          },
        });
        res.json({ rate });
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

async function validateRateWrite(body: Record<string, unknown>, scope: Record<string, unknown>, updating = false) {
  if (!updating && isProductType(body.productType) && body.productId) {
    const product = await loadOwnedProduct(body.productType, String(body.productId), scope);
    if (!product) return { status: 404, message: "Product not found" };
  }
  if (!isIsoDate(body.validFrom) || !isIsoDate(body.validTo) || String(body.validFrom) > String(body.validTo)) {
    return { status: 400, message: "validFrom and validTo must be YYYY-MM-DD, and validFrom must be on or before validTo" };
  }
  const cost = Number(body.contractedCost);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isInteger(cost)) {
    return { status: 400, message: "contractedCost must be a whole number of currency units" };
  }
  if (body.active === false) return null;
  return null;
}

