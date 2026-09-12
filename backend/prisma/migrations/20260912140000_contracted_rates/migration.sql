-- Phase 2: descriptive fields kept on specialized products; contracted cost lives on ContractedRate.

ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "closingTime" TEXT;
ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "ticketType" TEXT;
ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "passengerInfo" TEXT;

ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "images" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

ALTER TABLE "MealProduct" ADD COLUMN IF NOT EXISTS "restaurant" TEXT;
ALTER TABLE "MealProduct" ADD COLUMN IF NOT EXISTS "transferInclusion" TEXT NOT NULL DEFAULT 'NONE';

CREATE TABLE IF NOT EXISTS "FlightProduct" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT,
  "supplierId" TEXT,
  "destinationId" TEXT,
  "name" TEXT NOT NULL,
  "airline" TEXT NOT NULL,
  "flightNumber" TEXT,
  "origin" TEXT NOT NULL,
  "destinationAirport" TEXT NOT NULL,
  "departureTime" TEXT,
  "arrivalTime" TEXT,
  "duration" TEXT,
  "cabinClass" TEXT,
  "baggage" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'Active',
  "approvalStatus" TEXT NOT NULL DEFAULT 'Approved',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlightProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractedRate" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT,
  "productType" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "contractedCost" INTEGER NOT NULL,
  "validFrom" TEXT NOT NULL,
  "validTo" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractedRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FlightProduct_agencyId_idx" ON "FlightProduct"("agencyId");
CREATE INDEX IF NOT EXISTS "FlightProduct_destinationId_idx" ON "FlightProduct"("destinationId");
CREATE INDEX IF NOT EXISTS "FlightProduct_origin_idx" ON "FlightProduct"("origin");
CREATE INDEX IF NOT EXISTS "FlightProduct_status_idx" ON "FlightProduct"("status");
CREATE INDEX IF NOT EXISTS "FlightProduct_approvalStatus_idx" ON "FlightProduct"("approvalStatus");

CREATE INDEX IF NOT EXISTS "ContractedRate_agencyId_idx" ON "ContractedRate"("agencyId");
CREATE INDEX IF NOT EXISTS "ContractedRate_productType_productId_active_idx" ON "ContractedRate"("productType", "productId", "active");
CREATE INDEX IF NOT EXISTS "ContractedRate_validFrom_validTo_idx" ON "ContractedRate"("validFrom", "validTo");

DO $$ BEGIN
  ALTER TABLE "FlightProduct" ADD CONSTRAINT "FlightProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlightProduct" ADD CONSTRAINT "FlightProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
