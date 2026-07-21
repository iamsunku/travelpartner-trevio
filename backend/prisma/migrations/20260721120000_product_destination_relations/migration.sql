-- AlterTable
ALTER TABLE "HotelProduct" ADD COLUMN "destinationId" TEXT;

-- AlterTable
ALTER TABLE "ActivityProduct" ADD COLUMN "destinationId" TEXT;

-- AlterTable
ALTER TABLE "TransferProduct" ADD COLUMN "destinationId" TEXT;

-- CreateIndex
CREATE INDEX "HotelProduct_destinationId_idx" ON "HotelProduct"("destinationId");

-- CreateIndex
CREATE INDEX "ActivityProduct_destinationId_idx" ON "ActivityProduct"("destinationId");

-- CreateIndex
CREATE INDEX "TransferProduct_destinationId_idx" ON "TransferProduct"("destinationId");

-- AddForeignKey
ALTER TABLE "HotelProduct" ADD CONSTRAINT "HotelProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProduct" ADD CONSTRAINT "ActivityProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferProduct" ADD CONSTRAINT "TransferProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
