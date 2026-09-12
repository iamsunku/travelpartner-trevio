ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "storedName" TEXT;
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "storedName" TEXT;
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "uploadedById" TEXT;
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "relatedEntity" TEXT;
ALTER TABLE "BookingDocument" ADD COLUMN IF NOT EXISTS "quotationDocumentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BookingDocument_quotationDocumentId_key" ON "BookingDocument"("quotationDocumentId");

UPDATE "QuotationDocument" SET "visibility" = 'INTERNAL' WHERE lower("visibility") = 'internal';
UPDATE "QuotationDocument" SET "visibility" = 'AGENT' WHERE lower("visibility") = 'agent';
UPDATE "QuotationDocument" SET "visibility" = 'CUSTOMER' WHERE lower("visibility") = 'customer';

ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "gstProofDocumentId" TEXT;

CREATE TABLE IF NOT EXISTS "RegistrationDocument" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'GST_VAT_PROOF',
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'local',
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "claimToken" TEXT NOT NULL,
  "agencyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegistrationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationDocument_claimToken_key" ON "RegistrationDocument"("claimToken");
CREATE INDEX IF NOT EXISTS "RegistrationDocument_agencyId_idx" ON "RegistrationDocument"("agencyId");
