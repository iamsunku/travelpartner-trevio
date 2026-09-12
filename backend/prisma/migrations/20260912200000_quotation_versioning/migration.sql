-- Phase 7: quotation version linkage on documents and deliveries
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER;
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "quotationVersionId" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER;

CREATE INDEX IF NOT EXISTS "QuotationDocument_quotationVersionId_idx" ON "QuotationDocument"("quotationVersionId");

-- Backfill Version 1 for quotations that have no QuotationVersion rows yet.
-- Uses current live state only (does not invent unknown earlier revisions).
INSERT INTO "QuotationVersion" (
  "id",
  "quotationId",
  "versionNumber",
  "snapshot",
  "changeSummary",
  "reason",
  "createdByName",
  "createdById",
  "createdAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || q."id"),
  q."id",
  1,
  jsonb_build_object(
    'id', q."id",
    'quoteNo', q."quoteNo",
    'customerName', q."customerName",
    'destination', q."destination",
    'status', q."status",
    'approvalStatus', q."approvalStatus",
    'amount', q."amount",
    'gst', q."gst",
    'total', q."total",
    'currency', q."currency",
    'travelStartDate', q."travelStartDate",
    'travelEndDate', q."travelEndDate",
    'adults', q."adults",
    'children', q."children",
    'infants', q."infants",
    'legacyBackfill', true
  ),
  'Version 1 (legacy initial available state)',
  'legacy_backfill',
  COALESCE(q."createdBy", 'System'),
  q."createdById",
  COALESCE(q."createdAt", CURRENT_TIMESTAMP)
FROM "Quotation" q
WHERE q."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "QuotationVersion" v WHERE v."quotationId" = q."id"
  );

UPDATE "Quotation" q
SET "currentVersion" = GREATEST(
  COALESCE(q."currentVersion", 1),
  COALESCE((SELECT MAX(v."versionNumber") FROM "QuotationVersion" v WHERE v."quotationId" = q."id"), 1)
);
