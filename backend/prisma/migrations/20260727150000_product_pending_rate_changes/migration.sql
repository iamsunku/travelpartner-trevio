ALTER TABLE "HotelProduct" ADD COLUMN IF NOT EXISTS "pendingRateChanges" JSONB;
ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "pendingRateChanges" JSONB;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "pendingRateChanges" JSONB;
