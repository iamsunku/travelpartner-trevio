-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "agencyId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "agencyId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_idx" ON "AuditLog"("agencyId");

-- CreateIndex
CREATE INDEX "Lead_agencyId_idx" ON "Lead"("agencyId");

-- CreateIndex
CREATE INDEX "Notification_agencyId_idx" ON "Notification"("agencyId");

-- CreateIndex
CREATE INDEX "Payment_agencyId_idx" ON "Payment"("agencyId");

-- CreateIndex
CREATE INDEX "Quotation_agencyId_idx" ON "Quotation"("agencyId");

-- CreateIndex
CREATE INDEX "Task_agencyId_idx" ON "Task"("agencyId");
