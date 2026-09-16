-- Module 01A: Create Quote Basic Details + Trip Plan foundation
-- Additive, nullable/defaulted for legacy quotations.

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "rooms" INTEGER DEFAULT 1;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "landOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "estimatedBookingDate" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "tripCities" JSONB NOT NULL DEFAULT '[]';
