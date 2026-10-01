-- Structured booking service line fidelity + travel-agent code retention on Booking.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "agentCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "agencyCode" TEXT;

ALTER TABLE "BookingService" ADD COLUMN IF NOT EXISTS "lineDetails" JSONB;
