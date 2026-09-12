import type { Express, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { isAgentLike } from "../lib/quotations.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

export function mountTaxRuleRoutes(app: Express, agencyScope: ScopeFn) {
  app.get("/api/tax-rules", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const rules = await db.taxRule.findMany({
        where: agencyScope(req),
        orderBy: { createdAt: "desc" },
      });
      res.json({ rules });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/tax-rules", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      if (isAgentLike(req.auth?.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const name = String(req.body?.name || "").trim();
      const rate = Number(req.body?.rate);
      const method = req.body?.method === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE";
      if (!name || !Number.isFinite(rate) || rate < 0) {
        res.status(400).json({ error: "Tax name and a non-negative rate are required" });
        return;
      }
      const rule = await db.taxRule.create({
        data: {
          agencyId: req.auth?.agencyId,
          name,
          rate,
          method,
          active: req.body?.active !== false,
          scope: req.body?.scope || "QUOTATION",
          effectiveFrom: req.body?.effectiveFrom || null,
          effectiveTo: req.body?.effectiveTo || null,
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
        },
      });
      res.status(201).json({ rule });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
