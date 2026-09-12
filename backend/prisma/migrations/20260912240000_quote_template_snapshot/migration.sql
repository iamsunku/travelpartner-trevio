-- Phase 13: QuoteTemplate application snapshot on quotations
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "templateSnapshot" JSONB;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "appliedTemplateId" TEXT;
