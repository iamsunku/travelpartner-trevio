import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const KNOWN_QUOTE_STATUSES = [
  "Draft",
  "In Progress",
  "Pending Approval",
  "Sent to Agent",
  "Sent",
  "Customer Reviewing",
  "Revision Requested",
  "Accepted",
  "Rejected",
  "Expired",
  "Converted to Booking",
  "Archived",
];

async function countQuery(sql) {
  const rows = await db.$queryRawUnsafe(sql);
  return rows[0]?.c ?? 0;
}

async function main() {
  const out = {
    quotations: await db.quotation.count(),
    byStatus: await db.quotation.groupBy({ by: ["status"], _count: true }),
    versions: await db.quotationVersion.count(),
    duplicateVersionPairs: await db.$queryRawUnsafe(`
      SELECT "quotationId", "versionNumber", COUNT(*)::int AS c
      FROM "QuotationVersion"
      GROUP BY "quotationId", "versionNumber"
      HAVING COUNT(*) > 1
    `),
    bookings: await db.booking.count(),
    duplicateBookingQuotationIds: await db.$queryRawUnsafe(`
      SELECT "quotationId", COUNT(*)::int AS c
      FROM "Booking"
      WHERE "quotationId" IS NOT NULL
      GROUP BY "quotationId"
      HAVING COUNT(*) > 1
    `),
    orphanPackages: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "QuotationPackage" qp
      LEFT JOIN "Quotation" q ON q.id = qp."quotationId"
      WHERE q.id IS NULL
    `),
    orphanVersions: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "QuotationVersion" v
      LEFT JOIN "Quotation" q ON q.id = v."quotationId"
      WHERE q.id IS NULL
    `),
    convertedWithoutBooking: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "Quotation" q
      WHERE q.status = 'Converted to Booking'
      AND (
        q."convertedBookingId" IS NULL
        OR NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b.id = q."convertedBookingId")
      )
    `),
    bookingsMissingQuotation: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "Booking" b
      WHERE b."quotationId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Quotation" q WHERE q.id = b."quotationId")
    `),
    acceptedVersionMismatch: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "Quotation" q
      WHERE q.status = 'Accepted'
      AND q."acceptedVersionNumber" IS NOT NULL
      AND q."acceptedVersionNumber" <> q."currentVersion"
    `),
    unknownQuotationStatuses: (
      await db.quotation.findMany({ select: { status: true }, distinct: ["status"] })
    )
      .map((r) => r.status)
      .filter((s) => !KNOWN_QUOTE_STATUSES.includes(s)),
    bookingStatuses: await db.booking.groupBy({ by: ["status"], _count: true }),
    quotesWithTemplateSnapshot: await countQuery(`
      SELECT COUNT(*)::int AS c FROM "Quotation"
      WHERE "templateSnapshot" IS NOT NULL
    `),
    quotesWithAcceptedVersion: await db.quotation.count({
      where: { acceptedVersionNumber: { not: null } },
    }),
    hotels: await db.hotelProduct.count(),
    quoteTemplates: await db.quoteTemplate.count(),
  };

  try {
    out.flightProducts = await db.flightProduct.count();
  } catch {
    out.flightProducts = "N/A";
  }
  try {
    out.mealProducts = await db.mealProduct.count();
  } catch {
    out.mealProducts = "N/A";
  }
  try {
    out.taxRulesActive = await db.taxRule.count({ where: { isActive: true } });
    out.taxRulesTotal = await db.taxRule.count();
  } catch {
    out.taxRulesActive = "N/A";
    out.taxRulesTotal = "N/A";
  }

  try {
    out.legacyFlightLinesMissingSource = await countQuery(`
      SELECT COUNT(*)::int AS c
      FROM "QuotationPackage" qp,
      LATERAL jsonb_array_elements(
        CASE
          WHEN qp.flights IS NULL THEN '[]'::jsonb
          WHEN jsonb_typeof(qp.flights::jsonb) = 'array' THEN qp.flights::jsonb
          ELSE '[]'::jsonb
        END
      ) AS f(line)
      WHERE COALESCE(f.line->>'source', '') = ''
    `);
  } catch (e) {
    out.legacyFlightLinesMissingSource = String(e.message || e);
  }

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
