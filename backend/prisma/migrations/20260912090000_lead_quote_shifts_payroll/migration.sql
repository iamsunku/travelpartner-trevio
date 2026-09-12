-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "leadId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quotation_leadId_idx" ON "Quotation"("leadId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "branchId" TEXT,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "roleLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Shift_agencyId_idx" ON "Shift"("agencyId");
CREATE INDEX IF NOT EXISTS "Shift_branchId_idx" ON "Shift"("branchId");
CREATE INDEX IF NOT EXISTS "Shift_date_idx" ON "Shift"("date");
CREATE INDEX IF NOT EXISTS "Shift_employeeId_idx" ON "Shift"("employeeId");

CREATE TABLE IF NOT EXISTS "PayrollEntry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "incentives" INTEGER NOT NULL DEFAULT 0,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollEntry_agencyId_idx" ON "PayrollEntry"("agencyId");
CREATE INDEX IF NOT EXISTS "PayrollEntry_period_idx" ON "PayrollEntry"("period");
CREATE INDEX IF NOT EXISTS "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");
