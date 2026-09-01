-- Supplier payout enhancements + booking travel details
ALTER TABLE "SupplierPayout" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "bookingServiceId" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "serviceType" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "dueDate" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "reminderDaysBefore" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "SupplierPayout" ADD COLUMN "invoiceUrl" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupplierPayout" ADD COLUMN "scheduledPayDate" TEXT;
ALTER TABLE "SupplierPayout" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "SupplierPayout" ADD COLUMN "createdById" TEXT;

CREATE INDEX "SupplierPayout_dueDate_idx" ON "SupplierPayout"("dueDate");
CREATE INDEX "SupplierPayout_status_idx" ON "SupplierPayout"("status");

ALTER TABLE "Booking" ADD COLUMN "travelDetails" JSONB;
