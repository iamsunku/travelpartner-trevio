-- AlterTable
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "security" JSONB;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "commissionRules" JSONB;

-- AlterTable
ALTER TABLE "AgencyBranding" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
ALTER TABLE "AgencyBranding" ADD COLUMN IF NOT EXISTS "authorizedSignatory" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "paidBy" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TdsEntry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "deducted" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "date" TEXT NOT NULL,
    "partyName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TdsEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_agencyId_idx" ON "Expense"("agencyId");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category");
CREATE INDEX IF NOT EXISTS "TdsEntry_agencyId_idx" ON "TdsEntry"("agencyId");
CREATE INDEX IF NOT EXISTS "TdsEntry_date_idx" ON "TdsEntry"("date");
CREATE INDEX IF NOT EXISTS "TdsEntry_status_idx" ON "TdsEntry"("status");
