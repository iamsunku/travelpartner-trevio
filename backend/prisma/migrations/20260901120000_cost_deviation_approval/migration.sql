-- Cost deviation approval workflow
ALTER TABLE "BookingService" ADD COLUMN "quotedCostPrice" INTEGER NOT NULL DEFAULT 0;
UPDATE "BookingService" SET "quotedCostPrice" = "costPrice";

CREATE TABLE "CostDeviationApproval" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agencyId" TEXT,
    "bookingServiceId" TEXT,
    "deviationType" TEXT NOT NULL,
    "quotedCost" INTEGER NOT NULL DEFAULT 0,
    "proposedCost" INTEGER NOT NULL DEFAULT 0,
    "deltaAmount" INTEGER NOT NULL DEFAULT 0,
    "currentPackageValue" INTEGER NOT NULL DEFAULT 0,
    "proposedPackageValue" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "payload" JSONB,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostDeviationApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostDeviationApproval_bookingId_idx" ON "CostDeviationApproval"("bookingId");
CREATE INDEX "CostDeviationApproval_agencyId_idx" ON "CostDeviationApproval"("agencyId");
CREATE INDEX "CostDeviationApproval_status_idx" ON "CostDeviationApproval"("status");
CREATE INDEX "CostDeviationApproval_bookingServiceId_idx" ON "CostDeviationApproval"("bookingServiceId");

ALTER TABLE "CostDeviationApproval" ADD CONSTRAINT "CostDeviationApproval_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostDeviationApproval" ADD CONSTRAINT "CostDeviationApproval_bookingServiceId_fkey" FOREIGN KEY ("bookingServiceId") REFERENCES "BookingService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
