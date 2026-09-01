-- Supplier registration fields (country, city, bank, documents)
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "phoneCountryCode" TEXT DEFAULT '+91';
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "documentName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "accountHolder" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "accountNumber" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "ifscCode" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "swiftCode" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "bankCountry" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "Supplier_type_idx" ON "Supplier"("type");
CREATE INDEX IF NOT EXISTS "Supplier_country_city_idx" ON "Supplier"("country", "city");
