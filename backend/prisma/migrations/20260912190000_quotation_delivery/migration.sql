-- Phase 6: quotation email / WhatsApp delivery audit fields on QuotationShare
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "initiatedById" TEXT;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "packageCount" INTEGER;
ALTER TABLE "QuotationShare" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "QuotationShare_documentId_idx" ON "QuotationShare"("documentId");
