-- AlterTable
ALTER TABLE "ActivityProduct" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "HotelProduct" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "TransferProduct" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "ActivityProduct_approvalStatus_idx" ON "ActivityProduct"("approvalStatus");

-- CreateIndex
CREATE INDEX "HotelProduct_approvalStatus_idx" ON "HotelProduct"("approvalStatus");

-- CreateIndex
CREATE INDEX "TransferProduct_approvalStatus_idx" ON "TransferProduct"("approvalStatus");
