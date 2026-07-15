import type { Express, Response } from "express";
import type { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requirePermission, requireCrudPermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

function parseListQuery(req: AuthRequest) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const q = (req.query.q as string)?.trim();
  const status = req.query.status as string | undefined;
  const sort = (req.query.sort as string) || "createdAt";
  const order = (req.query.order as string) === "asc" ? "asc" : "desc";
  return { page, pageSize, q, status, sort, order, skip: (page - 1) * pageSize };
}

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

async function trackProductActivity(userId: string, agencyId?: string | null) {
  const date = new Date().toISOString().slice(0, 10);
  await db.employeeActivitySnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, agencyId: agencyId ?? undefined, date, productsUpdated: 1, lastActivity: "Product updated" },
    update: { productsUpdated: { increment: 1 }, lastActivity: "Product updated" },
  });
}

function registerHotelRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/products/hotels";

  app.get(base, requireAuth, requireCrudPermission("hotels", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const { page, pageSize, q, status, sort, order, skip } = parseListQuery(req);
      const where: Record<string, unknown> = { ...agencyScope(req) };
      if (status && status !== "All") where.status = status;
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
        ];
      }
      const [items, total] = await Promise.all([
        db.hotelProduct.findMany({ where, orderBy: { [sort]: order }, skip, take: pageSize }),
        db.hotelProduct.count({ where }),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(base, requireAuth, requireCrudPermission("hotels", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.hotelProduct.create({
        data: { ...req.body, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/duplicate`, requireAuth, requireCrudPermission("hotels", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.hotelProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing;
      const item = await db.hotelProduct.create({
        data: {
          ...rest,
          name: `${existing.name} (Copy)`,
          status: "Draft",
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
        } as Prisma.HotelProductCreateInput,
      });
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/archive`, requireAuth, requireCrudPermission("hotels", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.hotelProduct.update({ where: { id: paramId(req) }, data: { status: "Archived", updatedById: req.auth?.userId } });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id`, requireAuth, requireCrudPermission("hotels", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.hotelProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.hotelProduct.update({
        where: { id },
        data: { ...req.body, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/import`, requireAuth, requireCrudPermission("hotels", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      let imported = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          if (!row?.name) { failed += 1; continue; }
          await db.hotelProduct.create({
            data: { ...row, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
          });
          imported += 1;
        } catch {
          failed += 1;
        }
      }
      if (imported > 0) await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ imported, failed });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id`, requireAuth, requireCrudPermission("hotels", "delete"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.hotelProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.hotelProduct.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

function registerActivityRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/products/activities";

  app.get(base, requireAuth, requireCrudPermission("activities", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const { page, pageSize, q, status, sort, order, skip } = parseListQuery(req);
      const where: Record<string, unknown> = { ...agencyScope(req) };
      if (status && status !== "All") where.status = status;
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ];
      }
      const [items, total] = await Promise.all([
        db.activityProduct.findMany({ where, orderBy: { [sort]: order }, skip, take: pageSize }),
        db.activityProduct.count({ where }),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(base, requireAuth, requireCrudPermission("activities", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.activityProduct.create({
        data: { ...req.body, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/duplicate`, requireAuth, requireCrudPermission("activities", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing;
      const item = await db.activityProduct.create({
        data: {
          ...rest,
          name: `${existing.name} (Copy)`,
          status: "Draft",
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
        } as Prisma.ActivityProductCreateInput,
      });
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/archive`, requireAuth, requireCrudPermission("activities", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.activityProduct.update({ where: { id: paramId(req) }, data: { status: "Archived", updatedById: req.auth?.userId } });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id`, requireAuth, requireCrudPermission("activities", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.activityProduct.update({
        where: { id },
        data: { ...req.body, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/import`, requireAuth, requireCrudPermission("activities", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      let imported = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          if (!row?.name) { failed += 1; continue; }
          await db.activityProduct.create({
            data: { ...row, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
          });
          imported += 1;
        } catch {
          failed += 1;
        }
      }
      if (imported > 0) await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ imported, failed });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id`, requireAuth, requireCrudPermission("activities", "delete"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.activityProduct.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/submit-for-approval`, requireAuth, requireCrudPermission("activities", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.activityProduct.update({
        where: { id },
        data: { approvalStatus: "Pending", updatedById: req.auth?.userId },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/approve`, requireAuth, requirePermission("admin-approval"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.activityProduct.update({
        where: { id },
        data: {
          approvalStatus: "Approved",
          status: "Active",
          approvedBy: req.auth?.email,
          approvedAt: new Date(),
          updatedById: req.auth?.userId,
        },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/reject`, requireAuth, requirePermission("admin-approval"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.activityProduct.findFirst({ where: { id } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.activityProduct.update({
        where: { id },
        data: {
          approvalStatus: "Rejected",
          status: "Draft",
          rejectionReason: req.body.reason || "",
          updatedById: req.auth?.userId,
        },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

function registerTransferRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/products/transfers";

  app.get(base, requireAuth, requireCrudPermission("transfers", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const { page, pageSize, q, status, sort, order, skip } = parseListQuery(req);
      const where: Record<string, unknown> = { ...agencyScope(req) };
      if (status && status !== "All") where.status = status;
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { pickupLocation: { contains: q, mode: "insensitive" } },
          { dropLocation: { contains: q, mode: "insensitive" } },
        ];
      }
      const [items, total] = await Promise.all([
        db.transferProduct.findMany({ where, orderBy: { [sort]: order }, skip, take: pageSize }),
        db.transferProduct.count({ where }),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(base, requireAuth, requireCrudPermission("transfers", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.transferProduct.create({
        data: { ...req.body, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/duplicate`, requireAuth, requireCrudPermission("transfers", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing;
      const item = await db.transferProduct.create({
        data: {
          ...rest,
          name: `${existing.name} (Copy)`,
          status: "Draft",
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
        } as Prisma.TransferProductCreateInput,
      });
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/archive`, requireAuth, requireCrudPermission("transfers", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.transferProduct.update({ where: { id: paramId(req) }, data: { status: "Archived", updatedById: req.auth?.userId } });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id`, requireAuth, requireCrudPermission("transfers", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.transferProduct.update({
        where: { id },
        data: { ...req.body, updatedById: req.auth?.userId },
      });
      await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/import`, requireAuth, requireCrudPermission("transfers", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
      let imported = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          if (!row?.name || !row?.pickupLocation || !row?.dropLocation) { failed += 1; continue; }
          await db.transferProduct.create({
            data: { ...row, agencyId: req.auth?.agencyId, createdById: req.auth?.userId, updatedById: req.auth?.userId },
          });
          imported += 1;
        } catch {
          failed += 1;
        }
      }
      if (imported > 0) await trackProductActivity(req.auth!.userId, req.auth?.agencyId);
      res.json({ imported, failed });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id`, requireAuth, requireCrudPermission("transfers", "delete"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.transferProduct.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/submit-for-approval`, requireAuth, requireCrudPermission("transfers", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id, ...agencyScope(req) } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.transferProduct.update({
        where: { id },
        data: { approvalStatus: "Pending", updatedById: req.auth?.userId },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/approve`, requireAuth, requirePermission("admin-approval"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.transferProduct.update({
        where: { id },
        data: {
          approvalStatus: "Approved",
          status: "Active",
          approvedBy: req.auth?.email,
          approvedAt: new Date(),
          updatedById: req.auth?.userId,
        },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/reject`, requireAuth, requirePermission("admin-approval"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.transferProduct.findFirst({ where: { id } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.transferProduct.update({
        where: { id },
        data: {
          approvalStatus: "Rejected",
          status: "Draft",
          rejectionReason: req.body.reason || "",
          updatedById: req.auth?.userId,
        },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

export function mountProductRoutes(app: Express, agencyScope: ScopeFn) {
  registerHotelRoutes(app, agencyScope);
  registerActivityRoutes(app, agencyScope);
  registerTransferRoutes(app, agencyScope);

  app.get("/api/suppliers", requireAuth, requirePermission("suppliers"), async (req: AuthRequest, res: Response) => {
    try {
      const suppliers = await db.supplier.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" } });
      res.json({ suppliers, total: suppliers.length });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/suppliers", requireAuth, requirePermission("suppliers"), async (req: AuthRequest, res: Response) => {
    try {
      const supplier = await db.supplier.create({ data: { ...req.body, agencyId: req.auth?.agencyId } });
      res.status(201).json({ supplier });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/employees/activity", requireAuth, requirePermission("employees"), async (req: AuthRequest, res: Response) => {
    try {
      const snapshots = await db.employeeActivitySnapshot.findMany({
        where: agencyScope(req),
        orderBy: { date: "desc" },
        take: 100,
      });
      res.json({ activity: snapshots, total: snapshots.length });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const snap = await db.employeeActivitySnapshot.findUnique({
        where: { userId_date: { userId: req.auth!.userId, date } },
      });
      const workingMinutes = snap?.loginAt ? Math.round((now.getTime() - snap.loginAt.getTime()) / 60000) : 0;
      await db.employeeActivitySnapshot.upsert({
        where: { userId_date: { userId: req.auth!.userId, date } },
        create: { userId: req.auth!.userId, agencyId: req.auth?.agencyId, date, logoutAt: now, workingMinutes, lastActivity: "Logout" },
        update: { logoutAt: now, workingMinutes, lastActivity: "Logout" },
      });
      await db.auditLog.create({
        data: { userId: req.auth!.userId, agencyId: req.auth?.agencyId, userName: req.auth!.email, action: "Logout", module: "Auth", ip: req.ip || "0.0.0.0" },
      });
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/customers/:id/documents", requireAuth, requirePermission("customers"), async (req: AuthRequest, res: Response) => {
    try {
      const customerId = paramId(req);
      const documents = await db.customerDocument.findMany({
        where: { customerId, ...agencyScope(req) },
        orderBy: { createdAt: "desc" },
      });
      res.json({ documents });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/customers/:id/documents", requireAuth, requirePermission("customers"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await db.customerDocument.create({
        data: {
          customerId: paramId(req),
          agencyId: req.auth?.agencyId,
          name: req.body.name,
          type: req.body.type,
          url: req.body.url,
          uploadedBy: req.auth?.email,
        },
      });
      res.status(201).json({ document });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
