-- Hotel child policy
ALTER TABLE "HotelProduct" ADD COLUMN IF NOT EXISTS "childPolicy" JSONB NOT NULL DEFAULT '{}';

-- Activity infant pricing
ALTER TABLE "ActivityProduct" ADD COLUMN IF NOT EXISTS "infantPrice" INTEGER;

-- Transfer pricing enhancements
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "waitingCharges" INTEGER;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "sharedAdultPrice" INTEGER;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "sharedChildPrice" INTEGER;
ALTER TABLE "TransferProduct" ADD COLUMN IF NOT EXISTS "vehiclePricing" JSONB NOT NULL DEFAULT '[]';

-- International quotation fields
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "departureCity" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "returnDate" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "nights" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "days" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "roomTypePreference" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "mealPlanPreference" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "salesExecutiveName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "salesExecutivePhone" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "salesExecutiveEmail" TEXT;

-- Employee activity tracking extras
ALTER TABLE "EmployeeActivitySnapshot" ADD COLUMN IF NOT EXISTS "productsAdded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeActivitySnapshot" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "EmployeeActivitySnapshot" ADD COLUMN IF NOT EXISTS "deviceUsed" TEXT;
