/**
 * Re-seed Malaysia hotels + contracted rates only (from malaysia-catalog.json).
 * Usage: npx tsx scripts/import-malaysia-hotels-only.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error", "warn"] });
const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../../scripts/malaysia-catalog.json");

type HotelRoom = {
  name: string;
  usd: number;
  extraBedUsd?: number | null;
  inr: number;
  extraBedInr?: number | null;
};

type HotelRow = {
  name: string;
  city: string;
  country: string;
  starCategory: number;
  rooms: HotelRoom[];
};

type Catalog = {
  source: { validFrom: string; validTo: string };
  hotels: HotelRow[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureDestination(city: string, country = "Malaysia") {
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
      shortDescription: `${city}, ${country} — Trevio contracted ground inventory`,
      currency: "INR",
      status: "Active",
      visaRequired: true,
      metadata: { source: "malaysia-catalog-import" },
    },
  });
}

async function ensureSupplier(name: string, type: string) {
  const existing = await db.supplier.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return db.supplier.create({
    data: {
      name,
      type,
      country: "Malaysia",
      status: "Active",
      notes: "Imported with Malaysia contracted rate sheets",
    },
  });
}

async function upsertRoomRate(opts: {
  productId: string;
  roomType: string;
  contractedCost: number;
  sourceUsd: number;
  validFrom: string;
  validTo: string;
}) {
  const all = await db.contractedRate.findMany({
    where: {
      productType: "HOTEL",
      productId: opts.productId,
      active: true,
      validFrom: opts.validFrom,
      validTo: opts.validTo,
    },
  });
  const existing = all.find((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    return String(meta.roomType || "") === opts.roomType;
  });
  const data = {
    agencyId: null as string | null,
    currency: "INR",
    rateUnit: "PER_ROOM_NIGHT",
    contractedCost: Math.max(1, Math.round(opts.contractedCost)),
    metadata: {
      roomType: opts.roomType,
      source: "malaysia-contracted-rates.xlsx",
      sourceUsd: opts.sourceUsd,
    } as object,
  };
  if (existing) {
    await db.contractedRate.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await db.contractedRate.create({
    data: {
      productType: "HOTEL",
      productId: opts.productId,
      validFrom: opts.validFrom,
      validTo: opts.validTo,
      active: true,
      ...data,
    },
  });
  return created.id;
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Catalog;
  console.log("Seeding Malaysia hotels from", CATALOG_PATH);
  console.log({ hotels: catalog.hotels.length, rooms: catalog.hotels.reduce((n, h) => n + h.rooms.length, 0) });

  const supplier = await ensureSupplier("Malaysia Contracted Hotels", "Hotel");
  for (const city of ["Kuala Lumpur", "Genting Highlands", "Langkawi"]) {
    await ensureDestination(city);
  }

  let created = 0;
  let updated = 0;
  for (const h of catalog.hotels) {
    if (!h.rooms?.length) continue;
    const dest = await ensureDestination(h.city, h.country);
    const roomCategories = h.rooms.map((r) => ({
      name: r.name,
      mealPlan: "Breakfast",
      extraBedAllowed: r.extraBedInr != null,
      pricing: {
        single: r.inr,
        double: r.inr,
        extraAdult: r.extraBedInr ?? undefined,
      },
      sourceUsd: r.usd,
      sourceExtraBedUsd: r.extraBedUsd ?? undefined,
    }));
    const existing = await db.hotelProduct.findFirst({
      where: {
        name: { equals: h.name, mode: "insensitive" },
        city: { equals: h.city, mode: "insensitive" },
        country: "Malaysia",
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId: supplier.id,
      destinationId: dest.id,
      name: h.name,
      description: `Malaysia contracted hotel — ${h.city} (USD rate sheet × 84 → INR)`,
      starCategory: Math.min(5, Math.max(1, Number(h.starCategory) || 3)),
      city: h.city,
      country: "Malaysia",
      currency: "INR",
      roomCategories,
      contractStart: catalog.source.validFrom,
      contractEnd: catalog.source.validTo,
      status: "Active",
      approvalStatus: "Approved",
      cancellationPolicy: "As per hotel / supplier policy",
    };
    let productId: string;
    if (existing) {
      await db.hotelProduct.update({ where: { id: existing.id }, data: payload });
      productId = existing.id;
      updated += 1;
    } else {
      const row = await db.hotelProduct.create({ data: payload });
      productId = row.id;
      created += 1;
    }
    for (const r of h.rooms) {
      await upsertRoomRate({
        productId,
        roomType: r.name,
        contractedCost: r.inr,
        sourceUsd: r.usd,
        validFrom: catalog.source.validFrom,
        validTo: catalog.source.validTo,
      });
    }
    console.log(`✓ ${h.city} · ${h.name} (${h.rooms.length} rooms)`);
  }

  const total = await db.hotelProduct.count({ where: { country: "Malaysia" } });
  console.log({ created, updated, malaysiaHotelsInDb: total });
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
