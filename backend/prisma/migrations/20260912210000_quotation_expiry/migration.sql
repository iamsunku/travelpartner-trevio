-- Phase 8: quotation expiry automation support
-- Preserve existing validTill strings; add expiredAt audit timestamp + query index.

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Quotation_status_validTill_idx" ON "Quotation"("status", "validTill");
CREATE INDEX IF NOT EXISTS "Quotation_expiredAt_idx" ON "Quotation"("expiredAt");
