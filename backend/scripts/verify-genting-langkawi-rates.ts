/**
 * Verify Genting / Langkawi INR hotel rates after seed.
 */
import { PrismaClient } from "@prisma/client";
import { findApplicableContractedRate, rateVariantKey } from "../src/lib/contracted-rates";

const db = new PrismaClient({ log: ["error"] });

const EXPECTED: Array<{
  hotel: string;
  city: string;
  roomType: string;
  cost: number;
  extraBed: number;
  travelDate: string;
}> = [
  { hotel: "Swiss Garden Genting", city: "Genting Highlands", roomType: "Deluxe Double / Twin", cost: 5556, extraBed: 4023, travelDate: "2026-07-15" },
  { hotel: "Ion Majestic", city: "Genting Highlands", roomType: "Studio Room", cost: 8334, extraBed: 3544, travelDate: "2026-07-15" },
  { hotel: "Ion Majestic", city: "Genting Highlands", roomType: "Family Room (Sunday - Thursday)", cost: 15135, extraBed: 3544, travelDate: "2026-07-15" },
  { hotel: "Hotel Grand Continental Langkawi", city: "Langkawi", roomType: "Premium Single / Twin", cost: 4119, extraBed: 2012, travelDate: "2026-07-15" },
  { hotel: "Hotel Grand Continental Langkawi", city: "Langkawi", roomType: "Premium Triple", cost: 6035, extraBed: 2012, travelDate: "2026-07-15" },
  { hotel: "Bayview Hotel Langkawi", city: "Langkawi", roomType: "Sup", cost: 7280, extraBed: 3257, travelDate: "2026-07-15" },
  { hotel: "Bayview Hotel Langkawi", city: "Langkawi", roomType: "Deluxe", cost: 7855, extraBed: 3257, travelDate: "2026-07-15" },
  { hotel: "Dash Hotel Langkawi", city: "Langkawi", roomType: "Sup (Week Day) — High Season", cost: 14081, extraBed: 4023, travelDate: "2026-06-15" },
  { hotel: "Dash Hotel Langkawi", city: "Langkawi", roomType: "Sup (Week End) — High Season", cost: 14848, extraBed: 4023, travelDate: "2026-06-15" },
  { hotel: "Dash Hotel Langkawi", city: "Langkawi", roomType: "Sup (Week Day) — Normal Season", cost: 13602, extraBed: 4023, travelDate: "2026-07-15" },
  { hotel: "Dash Hotel Langkawi", city: "Langkawi", roomType: "Sup (Week End) — Normal Season", cost: 14369, extraBed: 4023, travelDate: "2026-07-15" },
];

async function main() {
  const failures: string[] = [];

  const klBefore = await db.hotelProduct.findMany({
    where: { country: "Malaysia", city: { equals: "Kuala Lumpur", mode: "insensitive" } },
    select: { id: true, name: true, currency: true },
    orderBy: { name: "asc" },
  });

  for (const row of EXPECTED) {
    const hotel = await db.hotelProduct.findFirst({
      where: {
        name: { equals: row.hotel, mode: "insensitive" },
        city: { equals: row.city, mode: "insensitive" },
        country: "Malaysia",
      },
    });
    if (!hotel) {
      failures.push(`MISSING HOTEL ${row.hotel} @ ${row.city}`);
      continue;
    }
    if (hotel.currency !== "INR") failures.push(`${row.hotel} currency=${hotel.currency}`);
    if (hotel.agencyId != null) failures.push(`${row.hotel} agencyId=${hotel.agencyId}`);

    const rooms = Array.isArray(hotel.roomCategories) ? (hotel.roomCategories as Array<Record<string, unknown>>) : [];
    const room = rooms.find((r) => String(r.name) === row.roomType);
    if (!room) failures.push(`${row.hotel} missing roomCategory ${row.roomType}`);
    else {
      const pricing = (room.pricing || {}) as Record<string, unknown>;
      if (Number(pricing.double) !== row.cost) {
        failures.push(`${row.hotel} ${row.roomType} roomCategory price ${pricing.double} != ${row.cost}`);
      }
      if (Number(pricing.extraAdult) !== row.extraBed) {
        failures.push(`${row.hotel} ${row.roomType} extraBed ${pricing.extraAdult} != ${row.extraBed}`);
      }
      if (room.sourceUsd != null) failures.push(`${row.hotel} ${row.roomType} still has sourceUsd`);
    }

    const rates = await db.contractedRate.findMany({
      where: { productType: "HOTEL", productId: hotel.id, active: true },
    });
    const variant = rateVariantKey({ roomType: row.roomType });
    const applicable = findApplicableContractedRate(
      rates.map((r) => ({
        id: r.id,
        contractedCost: r.contractedCost,
        currency: r.currency,
        rateUnit: r.rateUnit,
        validFrom: r.validFrom,
        validTo: r.validTo,
        active: r.active,
        metadata: r.metadata,
      })),
      row.travelDate,
      variant,
    );
    if (applicable.status !== "OK" || !applicable.rate) {
      failures.push(`${row.hotel} ${row.roomType} no applicable rate on ${row.travelDate}: ${applicable.status}`);
    } else {
      if (applicable.rate.currency !== "INR") {
        failures.push(`${row.hotel} ${row.roomType} rate currency ${applicable.rate.currency}`);
      }
      if (applicable.rate.contractedCost !== row.cost) {
        failures.push(`${row.hotel} ${row.roomType} contractedCost ${applicable.rate.contractedCost} != ${row.cost}`);
      }
      const meta = (applicable.rate.metadata || {}) as Record<string, unknown>;
      if (meta.sourceUsd != null) {
        failures.push(`${row.hotel} ${row.roomType} rate still has sourceUsd`);
      }
      if (Number(meta.extraBedInr) !== row.extraBed) {
        failures.push(`${row.hotel} ${row.roomType} rate extraBedInr ${meta.extraBedInr} != ${row.extraBed}`);
      }
    }
  }

  // Dash must keep 4 distinct seasonal/weekend rates
  const dash = await db.hotelProduct.findFirst({
    where: { name: { equals: "Dash Hotel Langkawi", mode: "insensitive" }, city: "Langkawi" },
  });
  if (dash) {
    const dashRates = await db.contractedRate.findMany({
      where: { productType: "HOTEL", productId: dash.id, active: true },
    });
    const types = dashRates.map((r) => String((r.metadata as Record<string, unknown>)?.roomType || ""));
    const expectedTypes = [
      "Sup (Week Day) — High Season",
      "Sup (Week End) — High Season",
      "Sup (Week Day) — Normal Season",
      "Sup (Week End) — Normal Season",
    ];
    for (const t of expectedTypes) {
      if (!types.includes(t)) failures.push(`Dash missing active rate ${t}`);
    }
  }

  const gentingNames = await db.hotelProduct.findMany({
    where: { country: "Malaysia", city: { equals: "Genting Highlands", mode: "insensitive" }, status: "Active" },
    select: { name: true },
  });
  const langkawiNames = await db.hotelProduct.findMany({
    where: { country: "Malaysia", city: { equals: "Langkawi", mode: "insensitive" }, status: "Active" },
    select: { name: true },
  });

  console.log(JSON.stringify({
    ok: failures.length === 0,
    failures,
    picker: {
      genting: gentingNames.map((h) => h.name),
      langkawi: langkawiNames.map((h) => h.name),
    },
    klHotelCount: klBefore.length,
    klSample: klBefore.slice(0, 3).map((h) => h.name),
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
