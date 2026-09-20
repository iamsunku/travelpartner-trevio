/**
 * Seed / refresh Genting Highlands + Langkawi hotel INR contracted rates.
 *
 * - Does NOT touch Kuala Lumpur hotels.
 * - agencyId = null (shared catalogue), currency = INR.
 * - Idempotent upsert of HotelProduct + ContractedRate.
 * - Preserves Dash Hotel seasonal / weekend rates as separate room-type variants.
 *
 * Usage: npx tsx scripts/seed-genting-langkawi-hotels.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error", "warn"] });

const VALID_FROM = "2026-01-01";
const VALID_TO = "2026-12-31";
const HIGH_SEASON_FROM = "2026-06-01";
const HIGH_SEASON_TO = "2026-06-30";
const SOURCE = "malaysia-genting-langkawi-inr-seed";

type RoomSeed = {
  roomType: string;
  roomRateInr: number;
  extraBedInr: number;
  season?: string;
  validFrom?: string;
  validTo?: string;
};

type HotelSeed = {
  /** Canonical product name in DB */
  name: string;
  /** Alternate names used when locating an existing product */
  aliases?: string[];
  city: "Genting Highlands" | "Langkawi";
  starCategory: number;
  rooms: RoomSeed[];
};

/**
 * Exact INR rates from the brief. City "Genting" → Genting Highlands (picker/catalogue convention).
 * "Ion Majesty" matches existing product "Ion Majestic".
 */
const HOTELS: HotelSeed[] = [
  {
    name: "Swiss Garden Genting",
    city: "Genting Highlands",
    starCategory: 4,
    rooms: [
      {
        roomType: "Deluxe Double / Twin",
        roomRateInr: 5556,
        extraBedInr: 4023,
      },
    ],
  },
  {
    name: "Ion Majestic",
    aliases: ["Ion Majesty"],
    city: "Genting Highlands",
    starCategory: 5,
    rooms: [
      {
        roomType: "Studio Room",
        roomRateInr: 8334,
        extraBedInr: 3544,
      },
      {
        roomType: "Family Room (Sunday - Thursday)",
        roomRateInr: 15135,
        extraBedInr: 3544,
        season: "Sunday - Thursday",
      },
    ],
  },
  {
    name: "Hotel Grand Continental Langkawi",
    city: "Langkawi",
    starCategory: 3,
    rooms: [
      {
        roomType: "Premium Single / Twin",
        roomRateInr: 4119,
        extraBedInr: 2012,
      },
      {
        roomType: "Premium Triple",
        roomRateInr: 6035,
        extraBedInr: 2012,
      },
    ],
  },
  {
    name: "Bayview Hotel Langkawi",
    city: "Langkawi",
    starCategory: 4,
    rooms: [
      {
        roomType: "Sup",
        roomRateInr: 7280,
        extraBedInr: 3257,
      },
      {
        roomType: "Deluxe",
        roomRateInr: 7855,
        extraBedInr: 3257,
      },
    ],
  },
  {
    name: "Dash Hotel Langkawi",
    city: "Langkawi",
    starCategory: 4,
    rooms: [
      {
        roomType: "Sup (Week Day) — High Season",
        roomRateInr: 14081,
        extraBedInr: 4023,
        season: "High Season",
        validFrom: HIGH_SEASON_FROM,
        validTo: HIGH_SEASON_TO,
      },
      {
        roomType: "Sup (Week End) — High Season",
        roomRateInr: 14848,
        extraBedInr: 4023,
        season: "Weekend · High Season",
        validFrom: HIGH_SEASON_FROM,
        validTo: HIGH_SEASON_TO,
      },
      {
        roomType: "Sup (Week Day) — Normal Season",
        roomRateInr: 13602,
        extraBedInr: 4023,
        season: "Normal Season",
      },
      {
        roomType: "Sup (Week End) — Normal Season",
        roomRateInr: 14369,
        extraBedInr: 4023,
        season: "Weekend · Normal Season",
      },
    ],
  },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function roomKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function ensureDestination(city: string, country = "Malaysia") {
  const slug = slugify(`${city}-${country}`);
  const existing = await db.destination.findFirst({
    where: {
      OR: [
        { slug },
        {
          AND: [
            { name: { equals: city, mode: "insensitive" } },
            { country: { equals: country, mode: "insensitive" } },
          ],
        },
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
      metadata: { source: SOURCE },
    },
  });
}

async function ensureSupplier() {
  const name = "Malaysia Contracted Hotels";
  const existing = await db.supplier.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return db.supplier.create({
    data: {
      name,
      type: "Hotel",
      country: "Malaysia",
      status: "Active",
      notes: "Imported with Malaysia contracted rate sheets",
    },
  });
}

async function findHotel(seed: HotelSeed) {
  const names = [seed.name, ...(seed.aliases || [])];
  for (const name of names) {
    const hit = await db.hotelProduct.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        city: { equals: seed.city, mode: "insensitive" },
        country: "Malaysia",
      },
    });
    if (hit) return hit;
  }
  return null;
}

function mergeRoomCategories(
  existingRaw: unknown,
  rooms: RoomSeed[],
): Array<Record<string, unknown>> {
  const existing = Array.isArray(existingRaw) ? (existingRaw as Array<Record<string, unknown>>) : [];
  return rooms.map((room) => {
    const prev =
      existing.find((r) => roomKey(String(r.name || "")) === roomKey(room.roomType))
      || existing.find((r) => roomKey(String(r.name || "")).includes(roomKey(room.roomType).slice(0, 8)))
      || null;
    const images = Array.isArray(prev?.images) ? prev!.images : undefined;
    return {
      ...(prev || {}),
      name: room.roomType,
      mealPlan: String(prev?.mealPlan || "Breakfast"),
      extraBedAllowed: true,
      pricing: {
        single: room.roomRateInr,
        double: room.roomRateInr,
        extraAdult: room.extraBedInr,
      },
      ...(room.season ? { season: room.season } : {}),
      ...(images ? { images } : {}),
      // INR-native seed — do not keep USD conversion fields on these rooms.
      sourceUsd: undefined,
      sourceExtraBedUsd: undefined,
    };
  });
}

async function upsertRoomRate(opts: {
  productId: string;
  room: RoomSeed;
}) {
  const validFrom = opts.room.validFrom || VALID_FROM;
  const validTo = opts.room.validTo || VALID_TO;
  const all = await db.contractedRate.findMany({
    where: {
      productType: "HOTEL",
      productId: opts.productId,
      validFrom,
      validTo,
    },
  });
  const existing = all.find((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    return String(meta.roomType || "") === opts.room.roomType;
  });

  const metadata: Record<string, unknown> = {
    roomType: opts.room.roomType,
    extraBedInr: opts.room.extraBedInr,
    source: SOURCE,
    currency: "INR",
  };
  if (opts.room.season) metadata.season = opts.room.season;

  const data = {
    agencyId: null as string | null,
    currency: "INR",
    rateUnit: "PER_ROOM_NIGHT",
    contractedCost: Math.max(1, Math.round(opts.room.roomRateInr)),
    active: true,
    metadata: metadata as object,
  };

  if (existing) {
    await db.contractedRate.update({ where: { id: existing.id }, data });
    return { id: existing.id, created: false };
  }

  const created = await db.contractedRate.create({
    data: {
      productType: "HOTEL",
      productId: opts.productId,
      validFrom,
      validTo,
      ...data,
    },
  });
  return { id: created.id, created: true };
}

/** Deactivate rates for this hotel whose roomType is no longer in the seed set. */
async function deactivateStaleRates(productId: string, keepRoomTypes: Set<string>) {
  const rates = await db.contractedRate.findMany({
    where: { productType: "HOTEL", productId, active: true },
  });
  let deactivated = 0;
  for (const rate of rates) {
    const meta = (rate.metadata || {}) as Record<string, unknown>;
    const roomType = String(meta.roomType || "");
    if (!keepRoomTypes.has(roomType)) {
      await db.contractedRate.update({
        where: { id: rate.id },
        data: { active: false },
      });
      deactivated += 1;
      console.log(`  deactivate stale rate · ${roomType || rate.id} (${rate.validFrom}→${rate.validTo})`);
    }
  }
  return deactivated;
}

async function main() {
  console.log("Seeding Genting Highlands + Langkawi hotel INR rates (KL untouched)…");

  const supplier = await ensureSupplier();
  await ensureDestination("Genting Highlands");
  await ensureDestination("Langkawi");

  let hotelsCreated = 0;
  let hotelsUpdated = 0;
  let ratesCreated = 0;
  let ratesUpdated = 0;
  let ratesDeactivated = 0;

  for (const seed of HOTELS) {
    if (seed.city !== "Genting Highlands" && seed.city !== "Langkawi") {
      throw new Error(`Refusing to seed non-Genting/Langkawi city: ${seed.city}`);
    }

    const dest = await ensureDestination(seed.city);
    const existing = await findHotel(seed);
    const roomCategories = mergeRoomCategories(existing?.roomCategories, seed.rooms);

    const payload = {
      agencyId: null as string | null,
      supplierId: supplier.id,
      destinationId: dest.id,
      name: seed.name,
      description: `Malaysia contracted hotel — ${seed.city} (INR rate sheet)`,
      starCategory: seed.starCategory,
      city: seed.city,
      country: "Malaysia",
      currency: "INR",
      roomCategories,
      contractStart: VALID_FROM,
      contractEnd: VALID_TO,
      status: "Active",
      approvalStatus: "Approved",
      cancellationPolicy: existing?.cancellationPolicy || "As per hotel / supplier policy",
    };

    let productId: string;
    if (existing) {
      await db.hotelProduct.update({ where: { id: existing.id }, data: payload });
      productId = existing.id;
      hotelsUpdated += 1;
      console.log(`upd ${seed.city} · ${seed.name}`);
    } else {
      const row = await db.hotelProduct.create({ data: payload });
      productId = row.id;
      hotelsCreated += 1;
      console.log(`new ${seed.city} · ${seed.name}`);
    }

    const keep = new Set(seed.rooms.map((r) => r.roomType));
    for (const room of seed.rooms) {
      const result = await upsertRoomRate({ productId, room });
      if (result.created) ratesCreated += 1;
      else ratesUpdated += 1;
      console.log(
        `  rate ${room.roomType} · INR ${room.roomRateInr}`
        + (room.season ? ` · ${room.season}` : "")
        + (room.validFrom ? ` · ${room.validFrom}→${room.validTo}` : ""),
      );
    }

    ratesDeactivated += await deactivateStaleRates(productId, keep);
  }

  // Verify KL untouched count snapshot
  const klCount = await db.hotelProduct.count({
    where: { country: "Malaysia", city: { equals: "Kuala Lumpur", mode: "insensitive" } },
  });
  const genting = await db.hotelProduct.count({
    where: { country: "Malaysia", city: { equals: "Genting Highlands", mode: "insensitive" } },
  });
  const langkawi = await db.hotelProduct.count({
    where: { country: "Malaysia", city: { equals: "Langkawi", mode: "insensitive" } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        hotelsCreated,
        hotelsUpdated,
        ratesCreated,
        ratesUpdated,
        ratesDeactivated,
        verify: { kualaLumpurHotels: klCount, gentingHotels: genting, langkawiHotels: langkawi },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
