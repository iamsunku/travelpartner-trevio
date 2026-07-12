-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");
