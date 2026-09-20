/**
 * Resume Malaysia tickets + guides import (hotels/transfers already loaded).
 * Usage: npx tsx scripts/import-malaysia-remaining.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error", "warn"] });
const CATALOG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/malaysia-catalog.json");

type Catalog = {
  source: { validFrom: string; validTo: string };
  tickets: Array<{
    name: string;
    city: string;
    country: string;
    adultMyr: number;
    childMyr?: number | null;
    adultInr: number;
    childInr?: number | null;
  }>;
  guides: Array<{ name: string; city: string; country: string; myr: number; inr: number }>;
};

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`retry ${i}/${attempts} ${label}: ${msg.slice(0, 140)}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
      try { await db.$disconnect(); } catch { /* */ }
      try { await db.$connect(); } catch { /* */ }
    }
  }
  throw last;
}

async function ensureDestination(city: string, country = "Malaysia") {
  return withRetry(async () => {
    const slug = slugify(`${city}-${country}`);
    const existing = await db.destination.findFirst({
      where: {
        OR: [
          { slug },
          { AND: [{ name: { equals: city, mode: "insensitive" } }, { country: { equals: country, mode: "insensitive" } }] },
        ],
      },
    });
    if (existing) {
      if (existing.status !== "Active") {
        return db.destination.update({ where: { id: existing.id }, data: { status: "Active" } });
      }
      return existing;
    }
    return db.destination.create({
      data: {
        name: city,
        country,
        city,
        slug,
        shortDescription: `${city}, ${country}`,
        currency: "INR",
        status: "Active",
        visaRequired: true,
        metadata: { source: "malaysia-catalog-import" },
      },
    });
  }, `dest:${city}`);
}

async function ensureSupplier() {
  return withRetry(async () => {
    const existing = await db.supplier.findFirst({ where: { name: { equals: "KTH Malaysia", mode: "insensitive" } } });
    if (existing) return existing;
    return db.supplier.create({
      data: { name: "KTH Malaysia", type: "DMC", country: "Malaysia", status: "Active" },
    });
  }, "supplier");
}

async function upsertRate(opts: {
  productId: string;
  contractedCost: number;
  validFrom: string;
  validTo: string;
  rateUnit: string;
  metadata: Record<string, unknown>;
}) {
  return withRetry(async () => {
    const existing = await db.contractedRate.findFirst({
      where: {
        productType: "ACTIVITY",
        productId: opts.productId,
        active: true,
        validFrom: opts.validFrom,
        validTo: opts.validTo,
      },
    });
    const data = {
      currency: "INR",
      rateUnit: opts.rateUnit,
      contractedCost: Math.max(1, Math.round(opts.contractedCost)),
      metadata: opts.metadata as object,
    };
    if (existing) {
      await db.contractedRate.update({ where: { id: existing.id }, data });
      return;
    }
    await db.contractedRate.create({
      data: {
        productType: "ACTIVITY",
        productId: opts.productId,
        validFrom: opts.validFrom,
        validTo: opts.validTo,
        active: true,
        ...data,
      },
    });
  }, `rate:${opts.productId.slice(0, 8)}`);
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Catalog;
  const supplier = await ensureSupplier();
  let ticketCreated = 0;
  let guideCreated = 0;

  for (let i = 0; i < catalog.tickets.length; i++) {
    const t = catalog.tickets[i];
    const dest = await ensureDestination(t.city, t.country);
    const productId = await withRetry(async () => {
      const existing = await db.activityProduct.findFirst({
        where: { name: { equals: t.name, mode: "insensitive" }, location: { equals: t.city, mode: "insensitive" } },
      });
      const payload = {
        agencyId: null as string | null,
        supplierId: supplier.id,
        destinationId: dest.id,
        name: t.name,
        description: `Malaysia attraction ticket (KTH 2026). Adult MYR ${t.adultMyr}.`,
        location: t.city,
        ticketType: "Entrance",
        adultPrice: t.adultInr,
        childPrice: t.childInr ?? t.adultInr,
        currency: "INR",
        rateValidFrom: catalog.source.validFrom,
        rateValidTo: catalog.source.validTo,
        status: "Active",
        approvalStatus: "Approved",
        cancellationPolicy: "As per attraction / supplier policy",
      };
      if (existing) {
        await db.activityProduct.update({ where: { id: existing.id }, data: payload });
        return existing.id;
      }
      ticketCreated += 1;
      return (await db.activityProduct.create({ data: payload })).id;
    }, `ticket:${i + 1}`);
    await upsertRate({
      productId,
      contractedCost: t.adultInr,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      rateUnit: "PER_PAX",
      metadata: { source: "KTH RATE SHEET 2026 - TICKET", adultMyr: t.adultMyr, childMyr: t.childMyr ?? undefined },
    });
    if ((i + 1) % 5 === 0 || i + 1 === catalog.tickets.length) console.log(`tickets ${i + 1}/${catalog.tickets.length}`);
  }

  for (let i = 0; i < catalog.guides.length; i++) {
    const g = catalog.guides[i];
    const dest = await ensureDestination(g.city, g.country);
    const name = `Guide — ${g.name}`;
    const productId = await withRetry(async () => {
      const existing = await db.activityProduct.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, location: { equals: g.city, mode: "insensitive" } },
      });
      const payload = {
        agencyId: null as string | null,
        supplierId: supplier.id,
        destinationId: dest.id,
        name,
        description: `KTH guide service 2026 (MYR ${g.myr}).`,
        location: g.city,
        ticketType: "Guide",
        adultPrice: g.inr,
        childPrice: g.inr,
        currency: "INR",
        rateValidFrom: catalog.source.validFrom,
        rateValidTo: catalog.source.validTo,
        status: "Active",
        approvalStatus: "Approved",
      };
      if (existing) {
        await db.activityProduct.update({ where: { id: existing.id }, data: payload });
        return existing.id;
      }
      guideCreated += 1;
      return (await db.activityProduct.create({ data: payload })).id;
    }, `guide:${i + 1}`);
    await upsertRate({
      productId,
      contractedCost: g.inr,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      rateUnit: "PER_SERVICE",
      metadata: { source: "KTH RATE SHEET 2026 - GUIDE", sourceMyr: g.myr },
    });
    if ((i + 1) % 5 === 0 || i + 1 === catalog.guides.length) console.log(`guides ${i + 1}/${catalog.guides.length}`);
  }

  console.log(JSON.stringify({ ok: true, ticketCreated, guideCreated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
