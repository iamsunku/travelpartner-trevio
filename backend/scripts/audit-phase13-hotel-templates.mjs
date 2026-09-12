import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const hotels = await db.hotelProduct.findMany({
  select: { id: true, name: true, inventory: true, blackoutDates: true, status: true, approvalStatus: true },
});

let withInventoryRows = 0;
let soldOutRows = 0;
let invalidInventoryDates = 0;

for (const h of hotels) {
  const inv = Array.isArray(h.inventory) ? h.inventory : [];
  if (inv.length) withInventoryRows += 1;
  for (const raw of inv) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw;
    const date = String(row.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalidInventoryDates += 1;
    if (String(row.soldOut || "").toLowerCase() === "yes" || row.soldOut === true) soldOutRows += 1;
  }
}

const rates = await db.contractedRate.findMany({
  where: { productType: "HOTEL" },
  select: { id: true, productId: true, validFrom: true, validTo: true, active: true },
});
let invalidRanges = 0;
for (const r of rates) {
  if (!r.validFrom || !r.validTo || r.validTo < r.validFrom) invalidRanges += 1;
}

const templates = await db.quoteTemplate.findMany({
  where: { deletedAt: null },
  include: { sections: true },
});
let templatesWithContent = 0;
for (const t of templates) {
  if (t.sections.some((s) => {
    const settings = s.settings && typeof s.settings === "object" ? s.settings : {};
    return Boolean(settings.content);
  })) templatesWithContent += 1;
}

const quotesWithTemplate = await db.quotation.count({ where: { appliedTemplateId: { not: null } } });

console.log(JSON.stringify({
  hotelProducts: hotels.length,
  hotelsWithInventoryRows: withInventoryRows,
  soldOutInventoryRows: soldOutRows,
  invalidInventoryDates,
  hotelContractedRates: rates.length,
  invalidHotelRateRanges: invalidRanges,
  quoteTemplates: templates.length,
  templatesWithSectionContent: templatesWithContent,
  quotationsWithAppliedTemplate: quotesWithTemplate,
}, null, 2));

await db.$disconnect();
