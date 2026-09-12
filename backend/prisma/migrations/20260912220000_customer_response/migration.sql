-- Phase 9: secure customer response access + append-only response history

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "acceptedVersionNumber" INTEGER;

-- Backfill: Accepted quotes without a recorded version are bound to currentVersion
-- so existing Accepted → convert paths keep working until a newer revision is created.
UPDATE "Quotation"
SET "acceptedVersionNumber" = "currentVersion"
WHERE "status" IN ('Accepted', 'Converted to Booking')
  AND "acceptedVersionNumber" IS NULL;

CREATE TABLE IF NOT EXISTS "QuotationCustomerAccess" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationCustomerAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuotationCustomerAccess_tokenHash_key" ON "QuotationCustomerAccess"("tokenHash");
CREATE INDEX IF NOT EXISTS "QuotationCustomerAccess_quotationId_idx" ON "QuotationCustomerAccess"("quotationId");
CREATE INDEX IF NOT EXISTS "QuotationCustomerAccess_versionNumber_idx" ON "QuotationCustomerAccess"("versionNumber");
CREATE INDEX IF NOT EXISTS "QuotationCustomerAccess_expiresAt_idx" ON "QuotationCustomerAccess"("expiresAt");
CREATE INDEX IF NOT EXISTS "QuotationCustomerAccess_revokedAt_idx" ON "QuotationCustomerAccess"("revokedAt");

CREATE TABLE IF NOT EXISTS "QuotationCustomerResponse" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "accessId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "responseType" TEXT NOT NULL,
    "comment" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "selectedPackageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationCustomerResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuotationCustomerResponse_quotationId_createdAt_idx" ON "QuotationCustomerResponse"("quotationId", "createdAt");
CREATE INDEX IF NOT EXISTS "QuotationCustomerResponse_quotationId_versionNumber_idx" ON "QuotationCustomerResponse"("quotationId", "versionNumber");
CREATE INDEX IF NOT EXISTS "QuotationCustomerResponse_responseType_idx" ON "QuotationCustomerResponse"("responseType");
CREATE INDEX IF NOT EXISTS "QuotationCustomerResponse_accessId_idx" ON "QuotationCustomerResponse"("accessId");

DO $$ BEGIN
  ALTER TABLE "QuotationCustomerAccess" ADD CONSTRAINT "QuotationCustomerAccess_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuotationCustomerResponse" ADD CONSTRAINT "QuotationCustomerResponse_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuotationCustomerResponse" ADD CONSTRAINT "QuotationCustomerResponse_accessId_fkey"
    FOREIGN KEY ("accessId") REFERENCES "QuotationCustomerAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
