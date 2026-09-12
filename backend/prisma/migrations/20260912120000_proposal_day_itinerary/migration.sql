-- AlterTable
ALTER TABLE "TravelProposal" ADD COLUMN IF NOT EXISTS "builderMode" TEXT NOT NULL DEFAULT 'package';
ALTER TABLE "TravelProposal" ADD COLUMN IF NOT EXISTS "tripMeta" JSONB;

CREATE INDEX IF NOT EXISTS "TravelProposal_builderMode_idx" ON "TravelProposal"("builderMode");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProposalShare" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT,
    "senderName" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Attempted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProposalShare_proposalId_idx" ON "ProposalShare"("proposalId");

ALTER TABLE "ProposalShare" DROP CONSTRAINT IF EXISTS "ProposalShare_proposalId_fkey";
ALTER TABLE "ProposalShare" ADD CONSTRAINT "ProposalShare_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TravelProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MealProduct" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "supplierId" TEXT,
    "destinationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealType" TEXT NOT NULL DEFAULT 'Other',
    "city" TEXT,
    "adultPrice" INTEGER NOT NULL DEFAULT 0,
    "childPrice" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "approvalStatus" TEXT NOT NULL DEFAULT 'Approved',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MealProduct_agencyId_idx" ON "MealProduct"("agencyId");
CREATE INDEX IF NOT EXISTS "MealProduct_destinationId_idx" ON "MealProduct"("destinationId");
CREATE INDEX IF NOT EXISTS "MealProduct_city_idx" ON "MealProduct"("city");
CREATE INDEX IF NOT EXISTS "MealProduct_status_idx" ON "MealProduct"("status");
CREATE INDEX IF NOT EXISTS "MealProduct_approvalStatus_idx" ON "MealProduct"("approvalStatus");
CREATE INDEX IF NOT EXISTS "MealProduct_mealType_idx" ON "MealProduct"("mealType");

ALTER TABLE "MealProduct" DROP CONSTRAINT IF EXISTS "MealProduct_destinationId_fkey";
ALTER TABLE "MealProduct" ADD CONSTRAINT "MealProduct_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MealProduct" DROP CONSTRAINT IF EXISTS "MealProduct_supplierId_fkey";
ALTER TABLE "MealProduct" ADD CONSTRAINT "MealProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
