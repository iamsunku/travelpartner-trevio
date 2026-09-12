import type { Express, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { SUPPLIER_REGISTER_ROLES } from "../lib/supplier-taxonomy.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

const REGISTER_ROLES = [...SUPPLIER_REGISTER_ROLES] as [string, ...string[]];

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : String(id ?? "");
}

const SUPPLIER_FIELDS = [
  "name", "contactPerson", "email", "phoneCountryCode", "phone",
  "country", "city", "type", "status",
  "documentUrl", "documentName",
  "bankName", "accountHolder", "accountNumber", "ifscCode", "swiftCode", "bankCountry",
  "notes",
] as const;

function pickSupplierBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const k of SUPPLIER_FIELDS) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  return data;
}

function validateSupplierInput(data: Record<string, unknown>, partial = false): string | null {
  if (!partial && !String(data.name || "").trim()) return "Supplier name is required";
  if (!partial && !String(data.country || "").trim()) return "Country is required";
  if (!partial && !String(data.city || "").trim()) return "City is required";
  if (!partial && !String(data.type || "").trim()) return "Supplier type is required";
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) return "Invalid email";
  return null;
}

export function mountSupplierRoutes(app: Express, agencyScope: ScopeFn) {
  app.get("/api/suppliers", requireAuth, requirePermission("suppliers"), async (req: AuthRequest, res: Response) => {
    try {
      const where: Record<string, unknown> = { ...agencyScope(req) };
      const type = req.query.type as string | undefined;
      const country = req.query.country as string | undefined;
      const city = req.query.city as string | undefined;
      const status = req.query.status as string | undefined;
      const q = String(req.query.q || "").trim();

      if (type && type !== "All") where.type = type;
      if (country && country !== "All") where.country = { equals: country, mode: "insensitive" };
      if (city && city !== "All") where.city = { equals: city, mode: "insensitive" };
      if (status && status !== "All") where.status = status;
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { contactPerson: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ];
      }

      const suppliers = await db.supplier.findMany({
        where,
        orderBy: [{ country: "asc" }, { city: "asc" }, { name: "asc" }],
      });
      res.json({ suppliers, total: suppliers.length });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, requirePermission("suppliers"), async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await db.supplier.findFirst({
        where: { id: paramId(req), ...agencyScope(req) },
      });
      if (!supplier) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ supplier });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/suppliers", requireAuth, requireRole(...REGISTER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const data = pickSupplierBody(req.body || {});
      const err = validateSupplierInput(data);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
      const supplier = await db.supplier.create({
        data: {
          ...data,
          name: String(data.name).trim(),
          type: String(data.type).trim(),
          country: String(data.country || "").trim() || null,
          city: String(data.city || "").trim() || null,
          agencyId: req.auth?.agencyId,
          createdById: req.auth?.userId,
          status: String(data.status || "Active"),
        } as Parameters<typeof db.supplier.create>[0]["data"],
      });
      res.status(201).json({ supplier });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/suppliers/:id", requireAuth, requireRole(...REGISTER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db.supplier.findFirst({
        where: { id: paramId(req), ...agencyScope(req) },
      });
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const data = pickSupplierBody(req.body || {});
      const err = validateSupplierInput(data, true);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
      const supplier = await db.supplier.update({
        where: { id: existing.id },
        data,
      });
      res.json({ supplier });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, requireRole("super_admin", "agency_admin"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db.supplier.findFirst({
        where: { id: paramId(req), ...agencyScope(req) },
      });
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const linked =
        (await db.hotelProduct.count({ where: { supplierId: existing.id } })) +
        (await db.activityProduct.count({ where: { supplierId: existing.id } })) +
        (await db.transferProduct.count({ where: { supplierId: existing.id } }));
      if (linked > 0) {
        await db.supplier.update({ where: { id: existing.id }, data: { status: "Inactive" } });
        res.json({ success: true, deactivated: true, message: "Supplier linked to products — marked Inactive instead of deleted" });
        return;
      }
      await db.supplier.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
