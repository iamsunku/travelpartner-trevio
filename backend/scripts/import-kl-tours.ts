/**
 * Import Kuala Lumpur Tours (KTH) as Activity products with flat INR contracted costs.
 * Also archives matching tour-like Transfer products that were mis-imported earlier.
 *
 * Usage: npx tsx scripts/import-kl-tours.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error", "warn"] });

const VALID_FROM = "2026-01-01";
const VALID_TO = "2026-12-31";
const CITY = "Kuala Lumpur";
const COUNTRY = "Malaysia";

/** User-provided KL Tours list (Base/Contracted Cost INR). */
const KL_TOURS: Array<{ name: string; costInr: number; duration?: string }> = [
  { name: "KL Half Day City Tour (3 Hours) - No Entrance Ticket", costInr: 4225, duration: "3 Hours" },
  { name: "KL Half Day City Tour (4 Hours) [Optional Twin Tower or KL Tower Entrance Ticket]", costInr: 5865, duration: "4 Hours" },
  { name: "KL Half Day Countryside Tour (3 Hours)", costInr: 4690, duration: "3 Hours" },
  { name: "KL Day [Aquaria / Zoo / KL Bird Park Visit - Choose 1] (3 Hours)", costInr: 5160, duration: "3 Hours" },
  { name: "KL Night Tour (4 Hours) [Optional Twin Tower or KL Tower Entrance Ticket]", costInr: 5865, duration: "4 Hours" },
  { name: "KL Night Tour (4 Hours) + Enroute Dinner Transfer [Optional Twin Tower or KL Tower Entrance Ticket]", costInr: 6565, duration: "4 Hours" },
  { name: "Half Day Putrajaya Tour (3 Hours) [Optional Putrajaya Cruise Entrance Ticket]", costInr: 5160, duration: "3 Hours" },
  { name: "Half Day Putrajaya Tour (4 Hours) [Optional Putrajaya Cruise Entrance Ticket]", costInr: 6100, duration: "4 Hours" },
  { name: "Full Day Sunway Lagoon Tour (8 Hours) [Optional Sunway Lagoon Entrance Ticket]", costInr: 8210, duration: "8 Hours" },
  { name: "Full Day Sunway Lagoon Tour Enroute Dinner (8 Hours) [Optional Sunway Lagoon Entrance Ticket]", costInr: 9385, duration: "8 Hours" },
  { name: "Full Day Genting Tour (8 Hours) + Enroute Batu Caves (30 Mins) [Optional 02 Way Genting Cable Car Entrance Ticket]", costInr: 10560, duration: "8 Hours" },
  { name: "Full Day Genting Tour (8 Hours) + Enroute Batu Caves (60 Mins) [Optional 02 Way Genting Cable Car Entrance Ticket]", costInr: 11260, duration: "8 Hours" },
  { name: "Full Day Genting Tour (8 Hours) + Enroute Batu Caves (30 Mins) + Enroute Dinner [Optional 02 Way Genting Cable Car Entrance Ticket]", costInr: 12200, duration: "8 Hours" },
  { name: "Full Day Malacca Tour (8 Hours)", costInr: 10560, duration: "8 Hours" },
  { name: "Full Day Port Dickson Tour (8 Hours) [Recommended Guest to bring wet cloth as beach activity can be done in the common beach]", costInr: 9385, duration: "8 Hours" },
  { name: "GAMUDA SKY LUDE 2 Way Transfer", costInr: 4225 },
  { name: "GAMUDA COVE SPLASHMANIA 2 way transfer", costInr: 4225 },
  { name: "Full Day Lost World Of Tambun Day Trip [Optional Lost World Entrance Ticket]", costInr: 15250 },
  { name: "Full Day Cameron Tour (8 Hours)", costInr: 15250, duration: "8 Hours" },
  { name: "Full Day Penang Tour (8 Hours)", costInr: 17595, duration: "8 Hours" },
  { name: "Full Day Legoland (8 Hours) [Optional Legoland Entrance Ticket]", costInr: 15250, duration: "8 Hours" },
  { name: "Lunch / Dinner Transfer (2 Way)", costInr: 3520 },
  { name: "Evening Firefly Tour [Optional Firefly / Blue Tears Entrance Ticket]", costInr: 7040 },
  { name: "KL Half Day Disposal (4 Hours) - Within City Limits", costInr: 5865, duration: "4 Hours" },
  { name: "KL Full Day Disposal (8 Hours) - Within City Limits", costInr: 10560, duration: "8 Hours" },
  { name: "Additional Hour for Extension - Per Hour", costInr: 1410, duration: "1 Hour" },
];

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function normName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureDestination() {
  const slug = slugify(`${CITY}-${COUNTRY}`);
  const existing = await db.destination.findFirst({
    where: {
      OR: [
        { slug },
        { AND: [{ name: { equals: CITY, mode: "insensitive" } }, { country: { equals: COUNTRY, mode: "insensitive" } }] },
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
      name: CITY,
      country: COUNTRY,
      city: CITY,
      slug,
      shortDescription: `${CITY}, ${COUNTRY}`,
      currency: "INR",
      status: "Active",
      visaRequired: true,
      metadata: { source: "kl-tours-import" },
    },
  });
}

async function ensureSupplier() {
  const existing = await db.supplier.findFirst({ where: { name: { equals: "KTH Malaysia", mode: "insensitive" } } });
  if (existing) return existing;
  return db.supplier.create({
    data: { name: "KTH Malaysia", type: "DMC", country: "Malaysia", status: "Active" },
  });
}

async function upsertRate(productId: string, contractedCost: number) {
  const existing = await db.contractedRate.findFirst({
    where: {
      productType: "ACTIVITY",
      productId,
      active: true,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
    },
  });
  const data = {
    currency: "INR",
    rateUnit: "PER_ACTIVITY",
    contractedCost: Math.max(1, Math.round(contractedCost)),
    metadata: {
      source: "KTH KL TOURS LIST",
      category: "Tours",
      city: CITY,
    },
  };
  if (existing) {
    await db.contractedRate.update({ where: { id: existing.id }, data });
    return;
  }
  await db.contractedRate.create({
    data: {
      productType: "ACTIVITY",
      productId,
      validFrom: VALID_FROM,
      validTo: VALID_TO,
      active: true,
      ...data,
    },
  });
}

async function importTours() {
  const dest = await ensureDestination();
  const supplier = await ensureSupplier();
  let created = 0;
  let updated = 0;

  for (const tour of KL_TOURS) {
    const existing = await db.activityProduct.findFirst({
      where: {
        name: { equals: tour.name, mode: "insensitive" },
        location: { equals: CITY, mode: "insensitive" },
      },
    });
    const payload = {
      agencyId: null as string | null,
      supplierId: supplier.id,
      destinationId: dest.id,
      name: tour.name,
      description: `Kuala Lumpur tour (KTH). Category: Tours. Flat contracted rate.`,
      location: CITY,
      ticketType: "Tours",
      duration: tour.duration || null,
      adultPrice: tour.costInr,
      childPrice: 0,
      currency: "INR",
      rateValidFrom: VALID_FROM,
      rateValidTo: VALID_TO,
      status: "Active",
      approvalStatus: "Approved",
      cancellationPolicy: "As per KTH supplier policy",
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
    await upsertRate(productId, tour.costInr);
    console.log(`${existing ? "upd" : "new"} ${tour.costInr} ${tour.name.slice(0, 72)}`);
  }
  return { created, updated };
}

async function archiveTourTransfers() {
  const transfers = await db.transferProduct.findMany({
    where: {
      status: "Active",
      OR: [
        { city: { equals: CITY, mode: "insensitive" } },
        { name: { contains: "KL ", mode: "insensitive" } },
        { name: { startsWith: "KL", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, city: true },
  });

  const tourNorms = KL_TOURS.map((t) => normName(t.name));
  let archived = 0;
  for (const t of transfers) {
    // Keep real point-to-point "One Way Transfer" rows.
    if (/^one way transfer/i.test(t.name)) continue;
    // Do not touch other cities (Langkawi / Penang / etc.).
    if (/langkawi|penang|beach hotel|north hotel/i.test(t.name)) continue;
    const n = normName(t.name);
    const looksLikeTour =
      tourNorms.some((tn) => n.includes(tn.slice(0, 28)) || tn.includes(n.slice(0, 28)))
      || (
        (/tour|disposal|gamuda|firefl|additional hour|lunch.?dinner transfer|lost world|splashmania|sky lude|sky luge/i.test(t.name))
        && !/^one way/i.test(t.name)
      );
    if (!looksLikeTour) continue;
    await db.transferProduct.update({
      where: { id: t.id },
      data: { status: "Archived", approvalStatus: "Rejected" },
    });
    archived += 1;
    console.log(`archived transfer: ${t.name.slice(0, 80)}`);
  }
  return { archived, scanned: transfers.length };
}

async function main() {
  const tours = await importTours();
  const archived = await archiveTourTransfers();
  console.log(JSON.stringify({ ok: true, tours, archived }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
