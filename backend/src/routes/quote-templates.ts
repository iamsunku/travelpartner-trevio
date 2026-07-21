import type { Express, Response } from "express";
import type { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requireCrudPermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  validate,
  quoteTemplateSchema,
  quoteTemplateUpdateSchema,
  agencyBrandingSchema,
} from "../lib/validation.js";
import { getQuotePreviewMockData } from "../lib/quote-preview-mock.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

const TEMPLATE_INCLUDE = {
  sections: { orderBy: { sortOrder: "asc" as const } },
  history: { orderBy: { createdAt: "desc" as const }, take: 50 },
};

const DEFAULT_SECTIONS = [
  { sectionType: "COVER", customTitle: "Cover Page", sortOrder: 0 },
  { sectionType: "OVERVIEW", customTitle: "Package Overview", sortOrder: 1 },
  { sectionType: "DESTINATION_HIGHLIGHTS", customTitle: "Destination Highlights", sortOrder: 2 },
  { sectionType: "ITINERARY", customTitle: "Day-wise Itinerary", sortOrder: 3 },
  { sectionType: "HOTELS", customTitle: "Hotels", sortOrder: 4 },
  { sectionType: "ACTIVITIES", customTitle: "Activities", sortOrder: 5 },
  { sectionType: "TRANSFERS", customTitle: "Transfers", sortOrder: 6 },
  { sectionType: "PRICING", customTitle: "Pricing Summary", sortOrder: 7 },
  { sectionType: "INCLUSIONS", customTitle: "Inclusions", sortOrder: 8 },
  { sectionType: "EXCLUSIONS", customTitle: "Exclusions", sortOrder: 9 },
  { sectionType: "TERMS", customTitle: "Terms & Conditions", sortOrder: 10 },
  { sectionType: "CONTACT", customTitle: "Contact Information", sortOrder: 11 },
];

type SectionInput = {
  sectionType: string;
  sortOrder?: number;
  isVisible?: boolean;
  customTitle?: string | null;
  settings?: Record<string, unknown>;
};

function validateDefaultTemplate(sections: SectionInput[]): string | null {
  const visible = sections.filter((s) => s.isVisible !== false);
  const types = new Set(visible.map((s) => s.sectionType));
  if (!types.has("COVER")) return "Default template must include Cover section";
  if (!types.has("ITINERARY")) return "Default template must include Itinerary section";
  if (!types.has("PRICING")) return "Default template must include Pricing section";
  return null;
}

async function syncSections(templateId: string, sections: SectionInput[]) {
  await db.quoteTemplateSection.deleteMany({ where: { templateId } });
  if (!sections.length) return;
  await db.quoteTemplateSection.createMany({
    data: sections
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s, i) => ({
        templateId,
        sectionType: s.sectionType,
        sortOrder: s.sortOrder ?? i,
        isVisible: s.isVisible ?? true,
        customTitle: s.customTitle ?? null,
        settings: (s.settings ?? {}) as Prisma.InputJsonValue,
      })),
  });
}

async function addHistory(templateId: string, action: string, summary: string | undefined, req: AuthRequest) {
  await db.quoteTemplateHistory.create({
    data: { templateId, action, summary, createdByName: req.auth?.email },
  });
}

export function mountQuoteTemplateRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/quote-templates";

  app.get(base, requireAuth, requireCrudPermission("quote-templates", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const status = req.query.status as string | undefined;
      const q = (req.query.q as string)?.trim();
      const where: Prisma.QuoteTemplateWhereInput = { ...agencyScope(req), deletedAt: null };
      if (status && status !== "All") where.status = status;
      if (q) {
        where.OR = [
          { templateName: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }
      const skip = (page - 1) * pageSize;
      const [items, total] = await Promise.all([
        db.quoteTemplate.findMany({
          where,
          include: { sections: { orderBy: { sortOrder: "asc" } }, _count: { select: { sections: true } } },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          skip,
          take: pageSize,
        }),
        db.quoteTemplate.count({ where }),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get(`${base}/:id`, requireAuth, requireCrudPermission("quote-templates", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.quoteTemplate.findFirst({
        where: { id: paramId(req), ...agencyScope(req), deletedAt: null },
        include: TEMPLATE_INCLUDE,
      });
      if (!item) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(base, requireAuth, requireCrudPermission("quote-templates", "add"), validate(quoteTemplateSchema), async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const sections = (body.sections as SectionInput[] | undefined)?.length
        ? (body.sections as SectionInput[])
        : DEFAULT_SECTIONS.map((s) => ({ ...s, isVisible: true, settings: {} }));

      const item = await db.quoteTemplate.create({
        data: {
          agencyId: req.auth?.agencyId,
          templateName: body.templateName as string,
          description: (body.description as string) || null,
          theme: (body.theme as string) || "Classic",
          primaryColor: (body.primaryColor as string) || "#2A7BBD",
          secondaryColor: (body.secondaryColor as string) || "#00A79D",
          fontFamily: (body.fontFamily as string) || "Inter",
          logo: (body.logo as string) || null,
          watermark: (body.watermark as string) || null,
          headerStyle: (body.headerStyle ?? {}) as Prisma.InputJsonValue,
          footerStyle: (body.footerStyle ?? {}) as Prisma.InputJsonValue,
          pageSize: (body.pageSize as string) || "A4",
          orientation: (body.orientation as string) || "portrait",
          backgroundImage: (body.backgroundImage as string) || null,
          showPageNumbers: body.showPageNumbers !== false,
          status: (body.status as string) || "Draft",
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
          createdByName: req.auth?.email,
          updatedByName: req.auth?.email,
        },
      });

      await syncSections(item.id, sections);
      await addHistory(item.id, "created", "Template created", req);
      const full = await db.quoteTemplate.findUnique({ where: { id: item.id }, include: TEMPLATE_INCLUDE });
      res.status(201).json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id`, requireAuth, requireCrudPermission("quote-templates", "edit"), validate(quoteTemplateUpdateSchema), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.quoteTemplate.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const body = req.body as Record<string, unknown>;
      const { sections, ...data } = body;

      await db.quoteTemplate.update({
        where: { id },
        data: {
          ...(data as Prisma.QuoteTemplateUpdateInput),
          headerStyle: data.headerStyle !== undefined ? data.headerStyle as Prisma.InputJsonValue : undefined,
          footerStyle: data.footerStyle !== undefined ? data.footerStyle as Prisma.InputJsonValue : undefined,
          updatedById: req.auth?.userId,
          updatedByName: req.auth?.email,
        },
      });

      if (sections) await syncSections(id, sections as SectionInput[]);
      await addHistory(id, "updated", "Template updated", req);

      const full = await db.quoteTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
      res.json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id`, requireAuth, requireCrudPermission("quote-templates", "delete"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      await db.quoteTemplate.update({
        where: { id },
        data: { deletedAt: new Date(), status: "Archived", updatedByName: req.auth?.email },
      });
      await addHistory(id, "archived", "Template archived", req);
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/duplicate`, requireAuth, requireCrudPermission("quote-templates", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const source = await db.quoteTemplate.findFirst({
        where: { id, ...agencyScope(req), deletedAt: null },
        include: { sections: true },
      });
      if (!source) { res.status(404).json({ error: "Not found" }); return; }

      const { id: _id, createdAt: _ca, updatedAt: _ua, sections, isDefault: _def, ...rest } = source;
      const item = await db.quoteTemplate.create({
        data: {
          ...rest,
          templateName: `${source.templateName} (Copy)`,
          isDefault: false,
          status: "Draft",
          headerStyle: rest.headerStyle as Prisma.InputJsonValue,
          footerStyle: rest.footerStyle as Prisma.InputJsonValue,
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
          createdByName: req.auth?.email,
          updatedByName: req.auth?.email,
        },
      });

      await syncSections(item.id, sections.map((s, i) => ({
        sectionType: s.sectionType,
        sortOrder: s.sortOrder ?? i,
        isVisible: s.isVisible,
        customTitle: s.customTitle,
        settings: s.settings as Record<string, unknown>,
      })));

      await addHistory(item.id, "duplicated", `Duplicated from ${source.templateName}`, req);
      const full = await db.quoteTemplate.findUnique({ where: { id: item.id }, include: TEMPLATE_INCLUDE });
      res.status(201).json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/default`, requireAuth, requireCrudPermission("quote-templates", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.quoteTemplate.findFirst({
        where: { id, ...agencyScope(req), deletedAt: null },
        include: { sections: true },
      });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const err = validateDefaultTemplate(existing.sections.map((s) => ({
        sectionType: s.sectionType,
        isVisible: s.isVisible,
      })));
      if (err) { res.status(400).json({ error: err }); return; }

      if (existing.status !== "Active") {
        res.status(400).json({ error: "Only Active templates can be set as default" });
        return;
      }

      await db.quoteTemplate.updateMany({
        where: { agencyId: existing.agencyId, isDefault: true },
        data: { isDefault: false },
      });
      const item = await db.quoteTemplate.update({
        where: { id },
        data: { isDefault: true, updatedByName: req.auth?.email },
        include: TEMPLATE_INCLUDE,
      });
      await addHistory(id, "set_default", "Set as default template", req);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/archive`, requireAuth, requireCrudPermission("quote-templates", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const item = await db.quoteTemplate.update({
        where: { id },
        data: { status: "Archived", isDefault: false, updatedByName: req.auth?.email },
        include: TEMPLATE_INCLUDE,
      });
      await addHistory(id, "archived", "Template archived", req);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/activate`, requireAuth, requireCrudPermission("quote-templates", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.quoteTemplate.findFirst({
        where: { id, ...agencyScope(req), deletedAt: null },
        include: { sections: true },
      });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const err = validateDefaultTemplate(existing.sections.map((s) => ({
        sectionType: s.sectionType,
        isVisible: s.isVisible,
      })));
      if (err) { res.status(400).json({ error: err }); return; }

      const item = await db.quoteTemplate.update({
        where: { id },
        data: { status: "Active", updatedByName: req.auth?.email },
        include: TEMPLATE_INCLUDE,
      });
      await addHistory(id, "activated", "Template activated", req);
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get(`${base}/:id/preview`, requireAuth, requireCrudPermission("quote-templates", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.quoteTemplate.findFirst({
        where: { id: paramId(req), ...agencyScope(req), deletedAt: null },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      });
      if (!item) { res.status(404).json({ error: "Not found" }); return; }

      const mockData = getQuotePreviewMockData();
      const visibleSections = item.sections.filter((s) => s.isVisible);
      res.json({ template: item, mockData, visibleSections });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Agency branding
  app.get("/api/settings/branding", requireAuth, requireCrudPermission("quote-templates", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = req.auth?.agencyId;
      if (!agencyId) { res.status(400).json({ error: "No agency context" }); return; }
      let branding = await db.agencyBranding.findUnique({ where: { agencyId } });
      if (!branding) {
        branding = await db.agencyBranding.create({ data: { agencyId } });
      }
      res.json({ branding });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/settings/branding", requireAuth, requireCrudPermission("quote-templates", "edit"), validate(agencyBrandingSchema), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = req.auth?.agencyId;
      if (!agencyId) { res.status(400).json({ error: "No agency context" }); return; }
      const body = req.body as Record<string, unknown>;
      const branding = await db.agencyBranding.upsert({
        where: { agencyId },
        create: {
          agencyId,
          primaryColor: (body.primaryColor as string) || "#2A7BBD",
          secondaryColor: (body.secondaryColor as string) || "#00A79D",
          fontFamily: (body.fontFamily as string) || "Inter",
          logo: (body.logo as string) || null,
          watermark: (body.watermark as string) || null,
          footerText: (body.footerText as string) || null,
          backgroundImage: (body.backgroundImage as string) || null,
          headerHtml: (body.headerHtml as string) || null,
          showPageNumbers: body.showPageNumbers !== false,
        },
        update: {
          primaryColor: body.primaryColor as string | undefined,
          secondaryColor: body.secondaryColor as string | undefined,
          fontFamily: body.fontFamily as string | undefined,
          logo: body.logo as string | null | undefined,
          watermark: body.watermark as string | null | undefined,
          footerText: body.footerText as string | null | undefined,
          backgroundImage: body.backgroundImage as string | null | undefined,
          headerHtml: body.headerHtml as string | null | undefined,
          showPageNumbers: body.showPageNumbers as boolean | undefined,
        },
      });
      res.json({ branding });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
