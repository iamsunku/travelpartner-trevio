-- AlterTable
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentCode" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "agentCode" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "agencyCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Agency_code_key" ON "Agency"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "User_agentCode_key" ON "User"("agentCode");
CREATE INDEX IF NOT EXISTS "User_agentCode_idx" ON "User"("agentCode");
