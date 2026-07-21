-- CreateTable
CREATE TABLE "TravelRequirement" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "branchId" TEXT,
    "requirementCode" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "destinationId" TEXT NOT NULL,
    "travelStartDate" TIMESTAMP(3) NOT NULL,
    "travelEndDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 1,
    "nights" INTEGER NOT NULL DEFAULT 0,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "budgetMin" INTEGER NOT NULL DEFAULT 0,
    "budgetMax" INTEGER NOT NULL DEFAULT 0,
    "hotelCategory" TEXT,
    "packageType" TEXT,
    "preferredMealPlan" JSONB NOT NULL DEFAULT '{}',
    "preferredTransfer" TEXT,
    "flightRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaRequired" BOOLEAN NOT NULL DEFAULT false,
    "insuranceRequired" BOOLEAN NOT NULL DEFAULT false,
    "specialRequests" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "selectedPackageId" TEXT,
    "markup" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRequirementSelection" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "hotelOptionGroup" TEXT,
    "activityOptionGroup" TEXT,
    "transferOptionGroup" TEXT,
    "markup" INTEGER NOT NULL DEFAULT 0,
    "hotelCost" INTEGER NOT NULL DEFAULT 0,
    "activityCost" INTEGER NOT NULL DEFAULT 0,
    "transferCost" INTEGER NOT NULL DEFAULT 0,
    "sellingPrice" INTEGER NOT NULL DEFAULT 0,
    "matchScore" DOUBLE PRECISION,
    "matchReasons" JSONB NOT NULL DEFAULT '[]',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelRequirementSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRequirementHistory" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelRequirementHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelRequirement_agencyId_idx" ON "TravelRequirement"("agencyId");

-- CreateIndex
CREATE INDEX "TravelRequirement_customerId_idx" ON "TravelRequirement"("customerId");

-- CreateIndex
CREATE INDEX "TravelRequirement_leadId_idx" ON "TravelRequirement"("leadId");

-- CreateIndex
CREATE INDEX "TravelRequirement_destinationId_idx" ON "TravelRequirement"("destinationId");

-- CreateIndex
CREATE INDEX "TravelRequirement_status_idx" ON "TravelRequirement"("status");

-- CreateIndex
CREATE INDEX "TravelRequirement_deletedAt_idx" ON "TravelRequirement"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TravelRequirement_agencyId_requirementCode_key" ON "TravelRequirement"("agencyId", "requirementCode");

-- CreateIndex
CREATE INDEX "TravelRequirementSelection_requirementId_idx" ON "TravelRequirementSelection"("requirementId");

-- CreateIndex
CREATE INDEX "TravelRequirementSelection_packageId_idx" ON "TravelRequirementSelection"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelRequirementSelection_requirementId_packageId_key" ON "TravelRequirementSelection"("requirementId", "packageId");

-- CreateIndex
CREATE INDEX "TravelRequirementHistory_requirementId_idx" ON "TravelRequirementHistory"("requirementId");

-- AddForeignKey
ALTER TABLE "TravelRequirement" ADD CONSTRAINT "TravelRequirement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequirement" ADD CONSTRAINT "TravelRequirement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequirement" ADD CONSTRAINT "TravelRequirement_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequirementSelection" ADD CONSTRAINT "TravelRequirementSelection_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TravelRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequirementHistory" ADD CONSTRAINT "TravelRequirementHistory_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TravelRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
