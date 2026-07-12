-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "collectedById" TEXT;

-- CreateIndex
CREATE INDEX "Payment_collectedById_idx" ON "Payment"("collectedById");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
