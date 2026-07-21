import type { Express, Response } from "express";
import type { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requireCrudPermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  validate,
  travelPackageSchema,
  travelPackageUpdateSchema,
  packageBulkStatusSchema,
  packageItinerarySchema,
  packageDaySchema,
  packageDayReorderSchema,
  packageTimelineReorderSchema,
  packageTimelineItemSchema,
  packageProductOptionsSchema,
  packageProductOptionSchema,
  packageOptionReorderSchema,
} from "../lib/validation.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function parseListQuery(req: AuthRequest) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const q = (req.query.q as string)?.trim();
  const status = req.query.status as string | undefined;
  const destinationId = req.query.destinationId as string | undefined;
  const packageType = req.query.packageType as string | undefined;
  const sort = (req.query.sort as string) || "updatedAt";
  const order = (req.query.order as string) === "asc" ? "asc" : "desc";
  return { page, pageSize, q, status, destinationId, packageType, sort, order, skip: (page - 1) * pageSize };
}

async function nextPackageCode(agencyId: string | null | undefined): Promise<string> {
  const count = await db.travelPackage.count({ where: { agencyId: agencyId ?? null } });
  return `PKG-${String(count + 1).padStart(4, "0")}`;
}

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
  _count: { select: { hotels: true, activities: true, transfers: true } },
};

type PackagePayload = {
  hotels?: { id: string; sortOrder?: number }[];
  activities?: { id: string; sortOrder?: number }[];
  transfers?: { id: string; sortOrder?: number }[];
  productOptions?: ProductOptionInput[];
  days?: ItineraryDayInput[];
  [key: string]: unknown;
};

type ProductOptionInput = {
  productType: string;
  productId: string;
  optionGroup: string;
  isDefault?: boolean;
  sortOrder?: number;
  priceAdjustment?: number;
  status?: string;
  notes?: string | null;
};

type ItineraryDayInput = {
  dayNumber: number;
  title: string;
  description?: string | null;
  mealPlan?: Record<string, boolean>;
  coverImage?: string | null;
  gallery?: string[];
  sortOrder?: number;
  items?: ItineraryItemInput[];
};

type ItineraryItemInput = {
  itemType: string;
  referenceId?: string | null;
  optionGroup?: string | null;
  title: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
  icon?: string | null;
  notes?: string | null;
};

function validateItineraryDays(days: ItineraryDayInput[]): string | null {
  if (!days.length) return null;
  const numbers = days.map((d) => d.dayNumber).sort((a, b) => a - b);
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return "Duplicate day numbers are not allowed";
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) return "Days must be sequential starting from 1";
  }
  return null;
}

async function syncItinerary(packageId: string, days: ItineraryDayInput[] = []) {
  await db.packageDay.deleteMany({ where: { packageId } });
  for (const day of days.sort((a, b) => a.dayNumber - b.dayNumber)) {
    const created = await db.packageDay.create({
      data: {
        packageId,
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description ?? null,
        mealPlan: (day.mealPlan ?? {}) as Prisma.InputJsonValue,
        coverImage: day.coverImage ?? null,
        gallery: (day.gallery ?? []) as Prisma.InputJsonValue,
        sortOrder: day.sortOrder ?? day.dayNumber - 1,
        items: {
          create: (day.items ?? [])
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item, i) => ({
              itemType: item.itemType,
              referenceId: item.referenceId ?? null,
              optionGroup: item.optionGroup ?? null,
              title: item.title,
              description: item.description ?? null,
              startTime: item.startTime ?? null,
              endTime: item.endTime ?? null,
              sortOrder: item.sortOrder ?? i,
              icon: item.icon ?? null,
              notes: item.notes ?? null,
            })),
        },
      },
    });
    void created;
  }
}

function validateOptionGroups(options: ProductOptionInput[]): string | null {
  const active = options.filter((o) => o.status !== "Inactive");
  const groups = new Map<string, ProductOptionInput[]>();
  for (const o of active) {
    const key = `${o.productType}::${o.optionGroup}`;
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  for (const [, list] of groups) {
    const defaults = list.filter((o) => o.isDefault);
    if (defaults.length !== 1) {
      return `Each option group must have exactly one default (${list[0]?.productType} / ${list[0]?.optionGroup})`;
    }
  }
  return null;
}

const BASE_TIER: Record<string, string[]> = {
  HOTEL: ["Standard", "Premium", "Luxury"],
  ACTIVITY: ["Included", "Optional", "Premium"],
  TRANSFER: ["Shared", "Private", "Luxury"],
};

function hotelProductPrice(roomCategories: unknown): number {
  const rooms = Array.isArray(roomCategories) ? (roomCategories as Record<string, unknown>[]) : [];
  const pricing = (rooms[0]?.pricing as Record<string, number>) ?? {};
  return pricing.double ?? pricing.single ?? 0;
}

async function resolveOptionPrices(options: ProductOptionInput[]) {
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
  return priceMap;
}

async function calcCostsFromDefaultOptions(options: ProductOptionInput[]) {
  const active = options.filter((o) => o.status !== "Inactive");
  const priceMap = await resolveOptionPrices(active);
  let hotelCost = 0;
  let activityCost = 0;
  let transferCost = 0;

  for (const type of ["HOTEL", "ACTIVITY", "TRANSFER"] as const) {
    const typeOpts = active.filter((o) => o.productType === type);
    const groups = [...new Set(typeOpts.map((o) => o.optionGroup))];
    const baseGroup = BASE_TIER[type].find((g) => groups.includes(g)) ?? groups[0];
    if (!baseGroup) continue;
    const def = typeOpts.find((o) => o.optionGroup === baseGroup && o.isDefault)
      ?? typeOpts.find((o) => o.optionGroup === baseGroup);
    if (!def) continue;
    const base = priceMap.get(def.productId) ?? 0;
    const cost = base + (def.priceAdjustment ?? 0);
    if (type === "HOTEL") hotelCost += cost;
    else if (type === "ACTIVITY") activityCost += cost;
    else transferCost += cost;
  }

  return { hotelCost, activityCost, transferCost };
}

async function syncProductOptions(packageId: string, options: ProductOptionInput[] = []) {
  await db.packageProductOption.deleteMany({ where: { packageId } });
  if (!options.length) return;
  await db.packageProductOption.createMany({
    data: options.map((o, i) => ({
      packageId,
      productType: o.productType,
      productId: o.productId,
      optionGroup: o.optionGroup,
      isDefault: o.isDefault ?? false,
      sortOrder: o.sortOrder ?? i,
      priceAdjustment: o.priceAdjustment ?? 0,
      status: o.status ?? "Active",
      notes: o.notes ?? null,
    })),
  });
}

function junctionsFromOptions(options: ProductOptionInput[]) {
  const hotels: { id: string; sortOrder: number }[] = [];
  const activities: { id: string; sortOrder: number }[] = [];
  const transfers: { id: string; sortOrder: number }[] = [];
  let hi = 0;
  let ai = 0;
  let ti = 0;
  const seen = { HOTEL: new Set<string>(), ACTIVITY: new Set<string>(), TRANSFER: new Set<string>() };

  for (const o of options) {
    if (o.status === "Inactive") continue;
    if (o.productType === "HOTEL" && !seen.HOTEL.has(o.productId)) {
      seen.HOTEL.add(o.productId);
      hotels.push({ id: o.productId, sortOrder: hi++ });
    } else if (o.productType === "ACTIVITY" && !seen.ACTIVITY.has(o.productId)) {
      seen.ACTIVITY.add(o.productId);
      activities.push({ id: o.productId, sortOrder: ai++ });
    } else if (o.productType === "TRANSFER" && !seen.TRANSFER.has(o.productId)) {
      seen.TRANSFER.add(o.productId);
      transfers.push({ id: o.productId, sortOrder: ti++ });
    }
  }
  return { hotels, activities, transfers };
}

async function enrichProductOptions(options: { productType: string; productId: string; [key: string]: unknown }[]) {
  if (!options.length) return [];
  const hotelIds = options.filter((o) => o.productType === "HOTEL").map((o) => o.productId);
  const activityIds = options.filter((o) => o.productType === "ACTIVITY").map((o) => o.productId);
  const transferIds = options.filter((o) => o.productType === "TRANSFER").map((o) => o.productId);

  const [hotels, activities, transfers] = await Promise.all([
    hotelIds.length ? db.hotelProduct.findMany({ where: { id: { in: hotelIds } }, include: { supplier: { select: { id: true, name: true } } } }) : [],
    activityIds.length ? db.activityProduct.findMany({ where: { id: { in: activityIds } }, include: { supplier: { select: { id: true, name: true } } } }) : [],
    transferIds.length ? db.transferProduct.findMany({ where: { id: { in: transferIds } }, include: { supplier: { select: { id: true, name: true } } } }) : [],
  ]);

  const byId = new Map<string, Record<string, unknown>>();
  for (const h of hotels) byId.set(h.id, { ...h, basePrice: hotelProductPrice(h.roomCategories) });
  for (const a of activities) byId.set(a.id, { ...a, basePrice: a.adultPrice ?? 0 });
  for (const t of transfers) byId.set(t.id, { ...t, basePrice: t.privatePrice ?? t.sharedPrice ?? 0 });

  return options.map((o) => ({
    ...o,
    product: byId.get(o.productId) ?? null,
  }));
}

function calcFinalPrice(hotelCost: number, activityCost: number, transferCost: number, markup: number, tax: number, discount: number) {
  const subtotal = hotelCost + activityCost + transferCost + markup;
  const afterTax = subtotal + tax;
  return Math.max(0, afterTax - discount);
}

function buildSnapshot(pkg: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(pkg));
}

async function syncJunctions(
  packageId: string,
  hotels: { id: string; sortOrder?: number }[] = [],
  activities: { id: string; sortOrder?: number }[] = [],
  transfers: { id: string; sortOrder?: number }[] = []
) {
  await db.$transaction([
    db.packageHotel.deleteMany({ where: { packageId } }),
    db.packageActivity.deleteMany({ where: { packageId } }),
    db.packageTransfer.deleteMany({ where: { packageId } }),
  ]);
  if (hotels.length) {
    await db.packageHotel.createMany({
      data: hotels.map((h, i) => ({
        packageId,
        hotelProductId: h.id,
        sortOrder: h.sortOrder ?? i,
      })),
    });
  }
  if (activities.length) {
    await db.packageActivity.createMany({
      data: activities.map((a, i) => ({
        packageId,
        activityProductId: a.id,
        sortOrder: a.sortOrder ?? i,
      })),
    });
  }
  if (transfers.length) {
    await db.packageTransfer.createMany({
      data: transfers.map((t, i) => ({
        packageId,
        transferProductId: t.id,
        sortOrder: t.sortOrder ?? i,
      })),
    });
  }
}

async function createVersion(packageId: string, versionNumber: number, snapshot: Record<string, unknown>, req: AuthRequest, summary?: string) {
  await db.packageVersion.create({
    data: {
      packageId,
      versionNumber,
      snapshot: snapshot as Prisma.InputJsonValue,
      changeSummary: summary ?? `Version ${versionNumber}`,
      createdById: req.auth?.userId,
      createdByName: req.auth?.email,
    },
  });
}

function validatePublish(hotelCount: number, activityCount: number): string | null {
  if (hotelCount < 1) return "Package must include at least 1 hotel to publish";
  if (activityCount < 1) return "Package must include at least 1 activity to publish";
  return null;
}

export function mountPackageRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/packages";

  app.get(base, requireAuth, requireCrudPermission("packages", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const { page, pageSize, q, status, destinationId, packageType, sort, order, skip } = parseListQuery(req);
      const where: Prisma.TravelPackageWhereInput = { ...agencyScope(req), deletedAt: null };
      if (status && status !== "All") where.status = status;
      if (destinationId && destinationId !== "All") where.destinationId = destinationId;
      if (packageType && packageType !== "All") where.packageType = packageType;
      if (q) {
        where.OR = [
          { packageName: { contains: q, mode: "insensitive" } },
          { packageCode: { contains: q, mode: "insensitive" } },
          { destination: { name: { contains: q, mode: "insensitive" } } },
        ];
      }
      const orderBy = { [sort]: order } as Prisma.TravelPackageOrderByWithRelationInput;
      const [items, total] = await Promise.all([
        db.travelPackage.findMany({ where, include: PACKAGE_INCLUDE, orderBy, skip, take: pageSize }),
        db.travelPackage.count({ where }),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get(`${base}/:id`, requireAuth, requireCrudPermission("packages", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await db.travelPackage.findFirst({
        where: { id: paramId(req), ...agencyScope(req), deletedAt: null },
        include: PACKAGE_INCLUDE,
      });
      if (!item) { res.status(404).json({ error: "Not found" }); return; }
      const enrichedOptions = item.productOptions?.length
        ? await enrichProductOptions(item.productOptions as { productType: string; productId: string; [key: string]: unknown }[])
        : [];
      res.json({ item: { ...item, productOptions: enrichedOptions } });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get(`${base}/:id/versions`, requireAuth, requireCrudPermission("packages", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const versions = await db.packageVersion.findMany({
        where: { packageId: id },
        orderBy: { versionNumber: "desc" },
      });
      res.json({ versions });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(base, requireAuth, requireCrudPermission("packages", "add"), validate(travelPackageSchema), async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as PackagePayload;
      const { hotels = [], activities = [], transfers = [], productOptions = [], days = [], ...data } = body;
      const itineraryErr = validateItineraryDays(days);
      if (itineraryErr) { res.status(400).json({ error: itineraryErr }); return; }
      if (productOptions.length) {
        const optErr = validateOptionGroups(productOptions);
        if (optErr) { res.status(400).json({ error: optErr }); return; }
      }
      const dest = await db.destination.findFirst({
        where: { id: data.destinationId as string, ...agencyScope(req), deletedAt: null },
      });
      if (!dest) { res.status(400).json({ error: "Invalid destination" }); return; }

      let hotelCost = Number(data.hotelCost ?? 0);
      let activityCost = Number(data.activityCost ?? 0);
      let transferCost = Number(data.transferCost ?? 0);
      if (productOptions.length) {
        const costs = await calcCostsFromDefaultOptions(productOptions);
        hotelCost = costs.hotelCost;
        activityCost = costs.activityCost;
        transferCost = costs.transferCost;
      }
      const markup = Number(data.markup ?? 0);
      const tax = Number(data.tax ?? 0);
      const discount = Number(data.discount ?? 0);
      const finalPrice = calcFinalPrice(hotelCost, activityCost, transferCost, markup, tax, discount);
      const packageCode = await nextPackageCode(req.auth?.agencyId);

      const item = await db.travelPackage.create({
        data: {
          ...(data as Prisma.TravelPackageCreateInput),
          packageCode,
          agencyId: req.auth?.agencyId,
          branchId: req.auth?.branchId,
          hotelCost,
          activityCost,
          transferCost,
          finalPrice,
          startingPrice: finalPrice,
          currentVersion: 1,
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
          createdByName: req.auth?.email,
          updatedByName: req.auth?.email,
        },
      });

      const junctions = productOptions.length
        ? junctionsFromOptions(productOptions)
        : { hotels, activities, transfers };
      if (productOptions.length) await syncProductOptions(item.id, productOptions);
      await syncJunctions(item.id, junctions.hotels, junctions.activities, junctions.transfers);
      if (days.length) await syncItinerary(item.id, days);
      const full = await db.travelPackage.findUnique({ where: { id: item.id }, include: PACKAGE_INCLUDE });
      if (full) await createVersion(item.id, 1, buildSnapshot(full), req, "Initial version");
      res.status(201).json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id`, requireAuth, requireCrudPermission("packages", "edit"), validate(travelPackageUpdateSchema), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const body = req.body as PackagePayload;
      const { hotels, activities, transfers, productOptions, days, ...data } = body;
      if (days) {
        const itineraryErr = validateItineraryDays(days);
        if (itineraryErr) { res.status(400).json({ error: itineraryErr }); return; }
      }
      if (productOptions) {
        const optErr = validateOptionGroups(productOptions);
        if (optErr) { res.status(400).json({ error: optErr }); return; }
      }

      if (data.destinationId) {
        const dest = await db.destination.findFirst({
          where: { id: data.destinationId as string, ...agencyScope(req), deletedAt: null },
        });
        if (!dest) { res.status(400).json({ error: "Invalid destination" }); return; }
      }

      let hotelCost = data.hotelCost !== undefined ? Number(data.hotelCost) : existing.hotelCost;
      let activityCost = data.activityCost !== undefined ? Number(data.activityCost) : existing.activityCost;
      let transferCost = data.transferCost !== undefined ? Number(data.transferCost) : existing.transferCost;
      if (productOptions?.length) {
        const costs = await calcCostsFromDefaultOptions(productOptions);
        hotelCost = costs.hotelCost;
        activityCost = costs.activityCost;
        transferCost = costs.transferCost;
      }
      const markup = data.markup !== undefined ? Number(data.markup) : existing.markup;
      const tax = data.tax !== undefined ? Number(data.tax) : existing.tax;
      const discount = data.discount !== undefined ? Number(data.discount) : existing.discount;
      const finalPrice = calcFinalPrice(hotelCost, activityCost, transferCost, markup, tax, discount);

      const nextVersion = existing.currentVersion + 1;

      await db.travelPackage.update({
        where: { id },
        data: {
          ...(data as Prisma.TravelPackageUpdateInput),
          hotelCost,
          activityCost,
          transferCost,
          finalPrice,
          startingPrice: data.startingPrice !== undefined ? Number(data.startingPrice) : finalPrice,
          currentVersion: nextVersion,
          updatedById: req.auth?.userId,
          updatedByName: req.auth?.email,
        },
      });

      if (productOptions !== undefined) {
        await syncProductOptions(id, productOptions);
        const junctions = junctionsFromOptions(productOptions);
        await syncJunctions(id, junctions.hotels, junctions.activities, junctions.transfers);
      } else if (hotels !== undefined || activities !== undefined || transfers !== undefined) {
        const current = await db.travelPackage.findUnique({
          where: { id },
          include: { hotels: true, activities: true, transfers: true },
        });
        await syncJunctions(
          id,
          hotels ?? current?.hotels.map((h, i) => ({ id: h.hotelProductId, sortOrder: h.sortOrder ?? i })),
          activities ?? current?.activities.map((a, i) => ({ id: a.activityProductId, sortOrder: a.sortOrder ?? i })),
          transfers ?? current?.transfers.map((t, i) => ({ id: t.transferProductId, sortOrder: t.sortOrder ?? i }))
        );
      }

      if (days !== undefined) await syncItinerary(id, days);

      const full = await db.travelPackage.findUnique({ where: { id }, include: PACKAGE_INCLUDE });
      if (full) await createVersion(id, nextVersion, buildSnapshot(full), req, `Updated to version ${nextVersion}`);
      res.json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/publish`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({
        where: { id, ...agencyScope(req), deletedAt: null },
        include: { _count: { select: { hotels: true, activities: true } } },
      });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const err = validatePublish(existing._count.hotels, existing._count.activities);
      if (err) { res.status(400).json({ error: err }); return; }

      const nextVersion = existing.currentVersion + 1;
      const item = await db.travelPackage.update({
        where: { id },
        data: { status: "Published", currentVersion: nextVersion, updatedById: req.auth?.userId, updatedByName: req.auth?.email },
        include: PACKAGE_INCLUDE,
      });
      await createVersion(id, nextVersion, buildSnapshot(item), req, "Published");
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/unpublish`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const nextVersion = existing.currentVersion + 1;
      const item = await db.travelPackage.update({
        where: { id },
        data: { status: "Draft", currentVersion: nextVersion, updatedById: req.auth?.userId, updatedByName: req.auth?.email },
        include: PACKAGE_INCLUDE,
      });
      await createVersion(id, nextVersion, buildSnapshot(item), req, "Unpublished");
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/archive`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const item = await db.travelPackage.update({
        where: { id },
        data: { status: "Archived", updatedById: req.auth?.userId, updatedByName: req.auth?.email },
        include: PACKAGE_INCLUDE,
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/duplicate`, requireAuth, requireCrudPermission("packages", "add"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({
        where: { id, ...agencyScope(req), deletedAt: null },
        include: PACKAGE_INCLUDE,
      });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const {
        id: _id,
        createdAt: _ca,
        updatedAt: _ua,
        packageCode: _pc,
        hotels,
        activities,
        transfers,
        days: sourceDays,
        productOptions: sourceOptions,
        destination: _dest,
        _count: _cnt,
        ...rest
      } = existing;

      const packageCode = await nextPackageCode(existing.agencyId);
      const item = await db.travelPackage.create({
        data: {
          ...rest,
          highlights: rest.highlights as Prisma.InputJsonValue,
          metadata: rest.metadata as Prisma.InputJsonValue,
          packageCode,
          packageName: `${existing.packageName} (Copy)`,
          status: "Draft",
          currentVersion: 1,
          isFeatured: false,
          createdById: req.auth?.userId,
          updatedById: req.auth?.userId,
          createdByName: req.auth?.email,
          updatedByName: req.auth?.email,
        },
      });

      await syncJunctions(
        item.id,
        hotels.map((h, i) => ({ id: h.hotelProductId, sortOrder: h.sortOrder ?? i })),
        activities.map((a, i) => ({ id: a.activityProductId, sortOrder: a.sortOrder ?? i })),
        transfers.map((t, i) => ({ id: t.transferProductId, sortOrder: t.sortOrder ?? i }))
      );

      if (sourceOptions?.length) {
        await syncProductOptions(
          item.id,
          sourceOptions.map((o) => ({
            productType: o.productType,
            productId: o.productId,
            optionGroup: o.optionGroup,
            isDefault: o.isDefault,
            sortOrder: o.sortOrder,
            priceAdjustment: o.priceAdjustment,
            status: o.status,
            notes: o.notes,
          }))
        );
      }

      if (sourceDays?.length) {
        await syncItinerary(
          item.id,
          sourceDays.map((d) => ({
            dayNumber: d.dayNumber,
            title: d.title,
            description: d.description,
            mealPlan: d.mealPlan as Record<string, boolean>,
            coverImage: d.coverImage,
            gallery: d.gallery as string[],
            sortOrder: d.sortOrder,
            items: d.items.map((it, i) => ({
              itemType: it.itemType,
              referenceId: it.referenceId,
              optionGroup: it.optionGroup,
              title: it.title,
              description: it.description,
              startTime: it.startTime,
              endTime: it.endTime,
              sortOrder: it.sortOrder ?? i,
              icon: it.icon,
              notes: it.notes,
            })),
          }))
        );
      }

      const full = await db.travelPackage.findUnique({ where: { id: item.id }, include: PACKAGE_INCLUDE });
      if (full) await createVersion(item.id, 1, buildSnapshot(full), req, "Duplicated from " + existing.packageCode);
      res.status(201).json({ item: full });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id`, requireAuth, requireCrudPermission("packages", "delete"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.travelPackage.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: req.auth?.userId, updatedByName: req.auth?.email },
      });
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/bulk-status`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageBulkStatusSchema), async (req: AuthRequest, res: Response) => {
    try {
      const { ids, status } = req.body as { ids: string[]; status: string };
      if (status === "Published") {
        for (const id of ids) {
          const pkg = await db.travelPackage.findFirst({
            where: { id, ...agencyScope(req), deletedAt: null },
            include: { _count: { select: { hotels: true, activities: true } } },
          });
          if (pkg) {
            const err = validatePublish(pkg._count.hotels, pkg._count.activities);
            if (err) { res.status(400).json({ error: err, packageId: id }); return; }
          }
        }
      }
      const result = await db.travelPackage.updateMany({
        where: { id: { in: ids }, ...agencyScope(req), deletedAt: null },
        data: { status, updatedById: req.auth?.userId, updatedByName: req.auth?.email },
      });
      res.json({ updated: result.count });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Itinerary endpoints ──────────────────────────────────────────────────

  app.get(`${base}/:id/itinerary`, requireAuth, requireCrudPermission("packages", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const days = await db.packageDay.findMany({
        where: { packageId: id },
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.json({ days });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put(`${base}/:id/itinerary`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageItinerarySchema), async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const days = req.body.days as ItineraryDayInput[];
      const err = validateItineraryDays(days);
      if (err) { res.status(400).json({ error: err }); return; }
      await syncItinerary(id, days);
      const updated = await db.packageDay.findMany({
        where: { packageId: id },
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.json({ days: updated });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/days`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageDaySchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id: packageId, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const body = req.body as ItineraryDayInput;
      const existing = await db.packageDay.findFirst({ where: { packageId, dayNumber: body.dayNumber } });
      if (existing) { res.status(400).json({ error: "Day number already exists" }); return; }
      const day = await db.packageDay.create({
        data: {
          packageId,
          dayNumber: body.dayNumber,
          title: body.title,
          description: body.description ?? null,
          mealPlan: (body.mealPlan ?? {}) as Prisma.InputJsonValue,
          coverImage: body.coverImage ?? null,
          gallery: (body.gallery ?? []) as Prisma.InputJsonValue,
          sortOrder: body.sortOrder ?? body.dayNumber - 1,
          items: {
            create: (body.items ?? []).map((item, i) => ({
              itemType: item.itemType,
              referenceId: item.referenceId ?? null,
              optionGroup: item.optionGroup ?? null,
              title: item.title,
              description: item.description ?? null,
              startTime: item.startTime ?? null,
              endTime: item.endTime ?? null,
              sortOrder: item.sortOrder ?? i,
              icon: item.icon ?? null,
              notes: item.notes ?? null,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.status(201).json({ day });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/days/:dayId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const dayId = req.params.dayId as string;
      const day = await db.packageDay.findFirst({ where: { id: dayId, packageId } });
      if (!day) { res.status(404).json({ error: "Day not found" }); return; }
      const body = req.body as Partial<ItineraryDayInput>;
      if (body.dayNumber && body.dayNumber !== day.dayNumber) {
        const clash = await db.packageDay.findFirst({ where: { packageId, dayNumber: body.dayNumber, NOT: { id: dayId } } });
        if (clash) { res.status(400).json({ error: "Day number already exists" }); return; }
      }
      const updated = await db.packageDay.update({
        where: { id: dayId },
        data: {
          ...(body.dayNumber !== undefined ? { dayNumber: body.dayNumber } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.mealPlan !== undefined ? { mealPlan: body.mealPlan as Prisma.InputJsonValue } : {}),
          ...(body.coverImage !== undefined ? { coverImage: body.coverImage } : {}),
          ...(body.gallery !== undefined ? { gallery: body.gallery as Prisma.InputJsonValue } : {}),
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.json({ day: updated });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id/days/:dayId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const dayId = req.params.dayId as string;
      await db.packageDay.delete({ where: { id: dayId } });
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/days/:dayId/duplicate`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const dayId = req.params.dayId as string;
      const source = await db.packageDay.findFirst({
        where: { id: dayId, packageId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!source) { res.status(404).json({ error: "Day not found" }); return; }
      const maxDay = await db.packageDay.aggregate({ where: { packageId }, _max: { dayNumber: true } });
      const nextNum = (maxDay._max.dayNumber ?? 0) + 1;
      const day = await db.packageDay.create({
        data: {
          packageId,
          dayNumber: nextNum,
          title: `${source.title} (Copy)`,
          description: source.description,
          mealPlan: source.mealPlan as Prisma.InputJsonValue,
          coverImage: source.coverImage,
          gallery: source.gallery as Prisma.InputJsonValue,
          sortOrder: nextNum - 1,
          items: {
            create: source.items.map((item, i) => ({
              itemType: item.itemType,
              referenceId: item.referenceId,
              title: item.title,
              description: item.description,
              startTime: item.startTime,
              endTime: item.endTime,
              sortOrder: i,
              icon: item.icon,
              notes: item.notes,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.status(201).json({ day });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/days/reorder`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageDayReorderSchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const { dayNumbers } = req.body as { dayNumbers: number[] };
      const days = await db.packageDay.findMany({ where: { packageId }, orderBy: { dayNumber: "asc" } });
      if (dayNumbers.length !== days.length) {
        res.status(400).json({ error: "Invalid day reorder payload" });
        return;
      }
      for (let i = 0; i < days.length; i++) {
        await db.packageDay.update({
          where: { id: days[i].id },
          data: { dayNumber: dayNumbers[i], sortOrder: i },
        });
      }
      const updated = await db.packageDay.findMany({
        where: { packageId },
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      res.json({ days: updated });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/days/:dayId/items/reorder`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageTimelineReorderSchema), async (req: AuthRequest, res: Response) => {
    try {
      const dayId = req.params.dayId as string;
      const { itemIds } = req.body as { itemIds: string[] };
      for (let i = 0; i < itemIds.length; i++) {
        await db.packageTimelineItem.update({
          where: { id: itemIds[i] },
          data: { sortOrder: i },
        });
      }
      const items = await db.packageTimelineItem.findMany({ where: { packageDayId: dayId }, orderBy: { sortOrder: "asc" } });
      res.json({ items });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/days/:dayId/items`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageTimelineItemSchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const dayId = req.params.dayId as string;
      const day = await db.packageDay.findFirst({ where: { id: dayId, packageId } });
      if (!day) { res.status(404).json({ error: "Day not found" }); return; }
      const body = req.body as ItineraryItemInput;
      const maxSort = await db.packageTimelineItem.aggregate({ where: { packageDayId: dayId }, _max: { sortOrder: true } });
      const item = await db.packageTimelineItem.create({
        data: {
          packageDayId: dayId,
          itemType: body.itemType,
          referenceId: body.referenceId ?? null,
          optionGroup: body.optionGroup ?? null,
          title: body.title,
          description: body.description ?? null,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
          icon: body.icon ?? null,
          notes: body.notes ?? null,
        },
      });
      res.status(201).json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/days/:dayId/items/:itemId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const dayId = req.params.dayId as string;
      const itemId = req.params.itemId as string;
      const existing = await db.packageTimelineItem.findFirst({ where: { id: itemId, packageDayId: dayId } });
      if (!existing) { res.status(404).json({ error: "Item not found" }); return; }
      const body = req.body as Partial<ItineraryItemInput>;
      const item = await db.packageTimelineItem.update({
        where: { id: itemId },
        data: {
          ...(body.itemType !== undefined ? { itemType: body.itemType } : {}),
          ...(body.referenceId !== undefined ? { referenceId: body.referenceId } : {}),
          ...(body.optionGroup !== undefined ? { optionGroup: body.optionGroup } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
          ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });
      res.json({ item });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id/days/:dayId/items/:itemId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const itemId = req.params.itemId as string;
      await db.packageTimelineItem.delete({ where: { id: itemId } });
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Product Options endpoints ─────────────────────────────────────────────

  app.get(`${base}/:id/product-options`, requireAuth, requireCrudPermission("packages", "view"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id: packageId, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const options = await db.packageProductOption.findMany({
        where: { packageId },
        orderBy: [{ productType: "asc" }, { optionGroup: "asc" }, { sortOrder: "asc" }],
      });
      const enriched = await enrichProductOptions(options);
      res.json({ options: enriched });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put(`${base}/:id/product-options`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageProductOptionsSchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id: packageId, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const options = req.body.options as ProductOptionInput[];
      const optErr = validateOptionGroups(options);
      if (optErr) { res.status(400).json({ error: optErr }); return; }
      await syncProductOptions(packageId, options);
      const junctions = junctionsFromOptions(options);
      await syncJunctions(packageId, junctions.hotels, junctions.activities, junctions.transfers);
      const costs = await calcCostsFromDefaultOptions(options);
      const finalPrice = calcFinalPrice(costs.hotelCost, costs.activityCost, costs.transferCost, pkg.markup, pkg.tax, pkg.discount);
      await db.travelPackage.update({
        where: { id: packageId },
        data: { hotelCost: costs.hotelCost, activityCost: costs.activityCost, transferCost: costs.transferCost, finalPrice, startingPrice: finalPrice },
      });
      const updated = await enrichProductOptions(await db.packageProductOption.findMany({ where: { packageId } }));
      res.json({ options: updated, costs, finalPrice });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post(`${base}/:id/product-options`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageProductOptionSchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const pkg = await db.travelPackage.findFirst({ where: { id: packageId, ...agencyScope(req), deletedAt: null } });
      if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
      const body = req.body as ProductOptionInput;
      const existing = await db.packageProductOption.findFirst({
        where: { packageId, productType: body.productType, productId: body.productId },
      });
      if (existing) { res.status(400).json({ error: "Product already in options" }); return; }
      if (body.isDefault) {
        await db.packageProductOption.updateMany({
          where: { packageId, productType: body.productType, optionGroup: body.optionGroup },
          data: { isDefault: false },
        });
      }
      const maxSort = await db.packageProductOption.aggregate({
        where: { packageId, productType: body.productType, optionGroup: body.optionGroup },
        _max: { sortOrder: true },
      });
      const option = await db.packageProductOption.create({
        data: {
          packageId,
          productType: body.productType,
          productId: body.productId,
          optionGroup: body.optionGroup,
          isDefault: body.isDefault ?? false,
          sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
          priceAdjustment: body.priceAdjustment ?? 0,
          status: body.status ?? "Active",
          notes: body.notes ?? null,
        },
      });
      const junctions = junctionsFromOptions(await db.packageProductOption.findMany({ where: { packageId } }));
      await syncJunctions(packageId, junctions.hotels, junctions.activities, junctions.transfers);
      res.status(201).json({ option });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/product-options/:optionId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const optionId = req.params.optionId as string;
      const existing = await db.packageProductOption.findFirst({ where: { id: optionId, packageId } });
      if (!existing) { res.status(404).json({ error: "Option not found" }); return; }
      const body = req.body as Partial<ProductOptionInput>;
      const optionGroup = body.optionGroup ?? existing.optionGroup;
      const productType = body.productType ?? existing.productType;
      if (body.isDefault) {
        await db.packageProductOption.updateMany({
          where: { packageId, productType, optionGroup, NOT: { id: optionId } },
          data: { isDefault: false },
        });
      }
      const option = await db.packageProductOption.update({
        where: { id: optionId },
        data: {
          ...(body.productType !== undefined ? { productType: body.productType } : {}),
          ...(body.productId !== undefined ? { productId: body.productId } : {}),
          ...(body.optionGroup !== undefined ? { optionGroup: body.optionGroup } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.priceAdjustment !== undefined ? { priceAdjustment: body.priceAdjustment } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });
      res.json({ option });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/product-options/:optionId/default`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const optionId = req.params.optionId as string;
      const existing = await db.packageProductOption.findFirst({ where: { id: optionId, packageId } });
      if (!existing) { res.status(404).json({ error: "Option not found" }); return; }
      await db.packageProductOption.updateMany({
        where: { packageId, productType: existing.productType, optionGroup: existing.optionGroup },
        data: { isDefault: false },
      });
      const option = await db.packageProductOption.update({
        where: { id: optionId },
        data: { isDefault: true },
      });
      res.json({ option });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete(`${base}/:id/product-options/:optionId`, requireAuth, requireCrudPermission("packages", "edit"), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const optionId = req.params.optionId as string;
      const existing = await db.packageProductOption.findFirst({ where: { id: optionId, packageId } });
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.packageProductOption.delete({ where: { id: optionId } });
      const remaining = await db.packageProductOption.findMany({ where: { packageId } });
      const groupRemaining = remaining.filter((o) => o.productType === existing.productType && o.optionGroup === existing.optionGroup && o.status !== "Inactive");
      if (existing.isDefault && groupRemaining.length > 0) {
        await db.packageProductOption.update({ where: { id: groupRemaining[0].id }, data: { isDefault: true } });
      }
      const junctions = junctionsFromOptions(remaining);
      await syncJunctions(packageId, junctions.hotels, junctions.activities, junctions.transfers);
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch(`${base}/:id/product-options/reorder`, requireAuth, requireCrudPermission("packages", "edit"), validate(packageOptionReorderSchema), async (req: AuthRequest, res: Response) => {
    try {
      const packageId = paramId(req);
      const { optionIds } = req.body as { optionIds: string[] };
      for (let i = 0; i < optionIds.length; i++) {
        await db.packageProductOption.update({
          where: { id: optionIds[i] },
          data: { sortOrder: i },
        });
      }
      const options = await db.packageProductOption.findMany({
        where: { packageId },
        orderBy: [{ productType: "asc" }, { optionGroup: "asc" }, { sortOrder: "asc" }],
      });
      res.json({ options });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
