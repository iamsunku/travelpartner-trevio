-- Phase 15: agent self-registration approval workflow
-- Existing agencies remain Approved (default). New public registrations set Submitted.

ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT NOT NULL DEFAULT 'Approved';
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationReviewComment" TEXT;
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationRejectionReason" TEXT;
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationReviewedAt" TIMESTAMP(3);
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationReviewedById" TEXT;
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "registrationReviewedByName" TEXT;

CREATE INDEX IF NOT EXISTS "Agency_registrationStatus_idx" ON "Agency"("registrationStatus");
