-- Phase 10: harden quotation → booking conversion
-- Unique binding prevents concurrent duplicate bookings from the same quotation.
-- quotationVersionNumber records which accepted version was converted.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "quotationVersionNumber" INTEGER;

-- Deduplicate legacy rows before unique index (keep earliest booking per quotation).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "quotationId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Booking"
  WHERE "quotationId" IS NOT NULL
)
UPDATE "Booking" b
SET "quotationId" = NULL
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_quotationId_key" ON "Booking"("quotationId");
