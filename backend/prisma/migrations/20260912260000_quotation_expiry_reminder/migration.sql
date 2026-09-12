-- Phase 17 EXP-02: durable pre-expiry reminder claims (idempotent across restarts / instances)

CREATE TABLE IF NOT EXISTS "QuotationExpiryReminder" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "validTill" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "reminderKind" TEXT NOT NULL DEFAULT 'PRE_EXPIRY',
    "daysBefore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "subject" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationExpiryReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuotationExpiryReminder_quotationId_validTill_reminderKind_versionNumber_key"
  ON "QuotationExpiryReminder"("quotationId", "validTill", "reminderKind", "versionNumber");

CREATE INDEX IF NOT EXISTS "QuotationExpiryReminder_quotationId_idx" ON "QuotationExpiryReminder"("quotationId");
CREATE INDEX IF NOT EXISTS "QuotationExpiryReminder_status_idx" ON "QuotationExpiryReminder"("status");
CREATE INDEX IF NOT EXISTS "QuotationExpiryReminder_validTill_idx" ON "QuotationExpiryReminder"("validTill");

DO $$ BEGIN
  ALTER TABLE "QuotationExpiryReminder"
    ADD CONSTRAINT "QuotationExpiryReminder_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
