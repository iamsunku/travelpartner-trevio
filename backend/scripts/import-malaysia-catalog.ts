/**
 * Import Malaysia catalogue from scripts/malaysia-catalog.json
 * (generated from KTH + Malaysia Contracted rates Excels).
 *
 * Usage: npx tsx scripts/import-malaysia-catalog.ts
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

type TransferRow = {
  name: string;
  city: string;
  country: string;
  myr: { car: number; van10?: number | null; van18?: number | null; van18Guide?: number | null };
  inr: { car: number; van10?: number | null; van18?: number | null; van18Guide?: number | null };
};

type TicketRow = {
  name: string;
  city: string;
  country: string;
  adultMyr: number;
  childMyr?: number | null;
  adultInr: number;
  childInr?: number | null;
};

type GuideRow = {
  name: string;
  city: string;
  country: string;
  myr: number;
  inr: number;
};

type Catalog = {
  source: { validFrom: string; validTo: string };
  hotels: HotelRow[];
  transfers: TransferRow[];
  tickets: TicketRow[];
  guides: GuideRow[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function inferPickupDrop(name: string): { pickup: string; drop: string } {
  const m = name.match(/from\s+(.+?)\s+-\s+(.+?)(?:\s*\(|$)/i);
  if (m) {
    return { pickup: m[1].trim(), drop: m[2].trim() };
  }
  return { pickup: "As per itinerary", drop: "As per itinerary" };
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

async function upsertContractedRate(opts: {
  agencyId?: string | null;
  productType: string;
  productId: string;
  currency: string;
  rateUnit: string;
  contractedCost: number;
  validFrom: string;
  validTo: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db.contractedRate.findFirst({
    where: {
      productType: opts.productType,
      productId: opts.productId,
      active: true,
      validFrom: opts.validFrom,
      validTo: opts.validTo,
    },
  });
  const data = {
    agencyId: opts.agencyId ?? null,
    currency: opts.currency,
    rateUnit: opts.rateUnit,
    contractedCost: Math.max(1, Math.round(opts.contractedCost)),
    metadata: (opts.metadata || {}) as object,
  };
  if (existing) {
    await db.contractedRate.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await db.contractedRate.create({
    data: {
      productType: opts.productType,
      productId: opts.productId,
      validFrom: opts.validFrom,
      validTo: opts.validTo,
      active: true,
      ...data,
    },
  });
  return created.id;
}

async function importHotels(catalog: Catalog, supplierId: string) {
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
    const primary = h.rooms[0];
    const existing = await db.hotelProduct.findFirst({
      where: {
        name: { equals: h.name, mode: "insensitive" },
        city: { equals: h.city, mode: "insensitive" },
        country: "Malaysia",
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId,
      destinationId: dest.id,
      name: h.name,
      description: `Malaysia contracted hotel — ${h.city} (imported from rate sheet, USD→INR)`,
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
    await upsertContractedRate({
      productType: "HOTEL",
      productId,
      currency: "INR",
      rateUnit: "PER_ROOM_NIGHT",
      contractedCost: primary.inr,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      metadata: { roomType: primary.name, source: "malaysia-contracted-rates.xlsx", sourceUsd: primary.usd },
    });
    // One contracted rate row per room category so room picker can resolve rates.
    for (const r of h.rooms.slice(1)) {
      const existingRoomRate = await db.contractedRate.findFirst({
        where: {
          productType: "HOTEL",
          productId,
          active: true,
          validFrom: catalog.source.validFrom,
          validTo: catalog.source.validTo,
          metadata: { path: ["roomType"], equals: r.name },
        },
      });
      if (existingRoomRate) {
        await db.contractedRate.update({
          where: { id: existingRoomRate.id },
          data: {
            contractedCost: Math.max(1, Math.round(r.inr)),
            currency: "INR",
            rateUnit: "PER_ROOM_NIGHT",
            metadata: { roomType: r.name, source: "malaysia-contracted-rates.xlsx", sourceUsd: r.usd },
          },
        });
      } else {
        await db.contractedRate.create({
          data: {
            productType: "HOTEL",
            productId,
            agencyId: null,
            currency: "INR",
            rateUnit: "PER_ROOM_NIGHT",
            contractedCost: Math.max(1, Math.round(r.inr)),
            validFrom: catalog.source.validFrom,
            validTo: catalog.source.validTo,
            active: true,
            metadata: { roomType: r.name, source: "malaysia-contracted-rates.xlsx", sourceUsd: r.usd },
          },
        });
      }
    }
  }
  return { created, updated };
}

async function importTransfers(catalog: Catalog, supplierId: string) {
  let created = 0;
  let updated = 0;
  for (const t of catalog.transfers) {
    const dest = await ensureDestination(t.city, t.country);
    const { pickup, drop } = inferPickupDrop(t.name);
    const vehiclePricing = [
      { vehicleType: "Sedan / Car", seats: 3, price: t.inr.car },
      t.inr.van10 != null ? { vehicleType: "Van 10-seater", seats: 6, price: t.inr.van10 } : null,
      t.inr.van18 != null ? { vehicleType: "Van 18-seater", seats: 13, price: t.inr.van18 } : null,
      t.inr.van18Guide != null ? { vehicleType: "Van 18-seater + Guide", seats: 13, price: t.inr.van18Guide } : null,
    ].filter(Boolean);
    const existing = await db.transferProduct.findFirst({
      where: {
        name: { equals: t.name, mode: "insensitive" },
        city: { equals: t.city, mode: "insensitive" },
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId,
      destinationId: dest.id,
      name: t.name,
      city: t.city,
      description: `KTH Malaysia transfer 2026 (MYR→INR). Source car rate MYR ${t.myr.car}.`,
      transferType: "Private",
      vehicleType: "Sedan / Car",
      capacity: 3,
      pickupLocation: pickup,
      dropLocation: drop,
      privatePrice: t.inr.car,
      vehiclePricing,
      currency: "INR",
      rateValidFrom: catalog.source.validFrom,
      rateValidTo: catalog.source.validTo,
      status: "Active",
      approvalStatus: "Approved",
      cancellationPolicy: "As per KTH supplier policy",
    };
    let productId: string;
    if (existing) {
      await db.transferProduct.update({ where: { id: existing.id }, data: payload });
      productId = existing.id;
      updated += 1;
    } else {
      const row = await db.transferProduct.create({ data: payload });
      productId = row.id;
      created += 1;
    }
    await upsertContractedRate({
      productType: "TRANSFER",
      productId,
      currency: "INR",
      rateUnit: "PER_VEHICLE",
      contractedCost: t.inr.car,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      metadata: { source: "KTH RATE SHEET 2026", vehicleType: "Sedan / Car", sourceMyr: t.myr.car },
    });
  }
  return { created, updated };
}

async function importTickets(catalog: Catalog, supplierId: string) {
  let created = 0;
  let updated = 0;
  let i = 0;
  for (const t of catalog.tickets) {
    i += 1;
    const dest = await ensureDestination(t.city, t.country);
    const existing = await db.activityProduct.findFirst({
      where: {
        name: { equals: t.name, mode: "insensitive" },
        location: { equals: t.city, mode: "insensitive" },
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId,
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
    let productId: string;
    if (existing) {
      await db.activityProduct.update({ where: { id: existing.id }, data: payload });
      productId = existing.id;
      updated += 1;
    } else {
      const row = await db.activityProduct.create({ data: payload });
      productId = row.id;
      created += 1;
    }
    await upsertContractedRate({
      productType: "ACTIVITY",
      productId,
      currency: "INR",
      rateUnit: "PER_PAX",
      contractedCost: t.adultInr,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      metadata: {
        source: "KTH RATE SHEET 2026 - TICKET",
        adultMyr: t.adultMyr,
        childMyr: t.childMyr ?? undefined,
      },
    });
    if (i % 10 === 0 || i === catalog.tickets.length) {
      console.log(`tickets ${i}/${catalog.tickets.length}`);
    }
  }
  return { created, updated };
}

async function importGuides(catalog: Catalog, supplierId: string) {
  let created = 0;
  let updated = 0;
  let i = 0;
  for (const g of catalog.guides) {
    i += 1;
    const dest = await ensureDestination(g.city, g.country);
    const name = `Guide — ${g.name}`;
    const existing = await db.activityProduct.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        location: { equals: g.city, mode: "insensitive" },
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId,
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
    let productId: string;
    if (existing) {
      await db.activityProduct.update({ where: { id: existing.id }, data: payload });
      productId = existing.id;
      updated += 1;
    } else {
      const row = await db.activityProduct.create({ data: payload });
      productId = row.id;
      created += 1;
    }
    await upsertContractedRate({
      productType: "ACTIVITY",
      productId,
      currency: "INR",
      rateUnit: "PER_SERVICE",
      contractedCost: g.inr,
      validFrom: catalog.source.validFrom,
      validTo: catalog.source.validTo,
      metadata: { source: "KTH RATE SHEET 2026 - GUIDE", sourceMyr: g.myr },
    });
    if (i % 10 === 0 || i === catalog.guides.length) {
      console.log(`guides ${i}/${catalog.guides.length}`);
    }
  }
  return { created, updated };
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Catalog;
  console.log("Loading", CATALOG_PATH);
  console.log({
    hotels: catalog.hotels.length,
    transfers: catalog.transfers.length,
    tickets: catalog.tickets.length,
    guides: catalog.guides.length,
  });

  const hotelSupplier = await ensureSupplier("Malaysia Contracted Hotels", "Hotel");
  const kthSupplier = await ensureSupplier("KTH Malaysia", "DMC");

  // Destinations used in trip builder cities
  for (const city of ["Kuala Lumpur", "Genting Highlands", "Langkawi", "Penang", "Malacca", "Putrajaya"]) {
    await ensureDestination(city);
  }

  console.log("import hotels…");
  const hotels = await importHotels(catalog, hotelSupplier.id);
  console.log("hotels done", hotels);
  console.log("import transfers…");
  const transfers = await importTransfers(catalog, kthSupplier.id);
  console.log("transfers done", transfers);
  console.log("import tickets…");
  const tickets = await importTickets(catalog, kthSupplier.id);
  console.log("tickets done", tickets);
  console.log("import guides…");
  const guides = await importGuides(catalog, kthSupplier.id);
  console.log("guides done", guides);

  console.log(JSON.stringify({ ok: true, hotels, transfers, tickets, guides }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
