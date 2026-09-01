-- Phase 3: itinerary, driver details, invoice GST breakdown, agent product access
ALTER TABLE "Booking" ADD COLUMN "itinerary" JSONB;

ALTER TABLE "BookingService" ADD COLUMN "driverDetails" JSONB;

ALTER TABLE "BookingInvoice" ADD COLUMN "lineItems" JSONB;
ALTER TABLE "BookingInvoice" ADD COLUMN "taxableAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingInvoice" ADD COLUMN "cgst" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingInvoice" ADD COLUMN "sgst" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingInvoice" ADD COLUMN "igst" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingInvoice" ADD COLUMN "gstRate" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "BookingInvoice" ADD COLUMN "gstNumber" TEXT;
ALTER TABLE "BookingInvoice" ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingInvoice" ADD COLUMN "balanceAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN "productAccess" JSONB;
