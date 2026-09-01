-- Agent quotation markup (B2B agent adds margin on platform package price)
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "agentMarkup" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "baseSellingTotal" INTEGER NOT NULL DEFAULT 0;
