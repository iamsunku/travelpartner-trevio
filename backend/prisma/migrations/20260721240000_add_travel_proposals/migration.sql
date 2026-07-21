-- CreateTable
CREATE TABLE "TravelProposal" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "proposalNumber" TEXT NOT NULL,
    "travelRequirementId" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "selectedPackageId" TEXT,
    "selectedTemplateId" TEXT,
    "proposalStatus" TEXT NOT NULL DEFAULT 'Draft',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSnapshot" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalHistory" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "versionNumber" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelProposal_agencyId_proposalNumber_key" ON "TravelProposal"("agencyId", "proposalNumber");

-- CreateIndex
CREATE INDEX "TravelProposal_agencyId_idx" ON "TravelProposal"("agencyId");

-- CreateIndex
CREATE INDEX "TravelProposal_travelRequirementId_idx" ON "TravelProposal"("travelRequirementId");

-- CreateIndex
CREATE INDEX "TravelProposal_customerId_idx" ON "TravelProposal"("customerId");

-- CreateIndex
CREATE INDEX "TravelProposal_leadId_idx" ON "TravelProposal"("leadId");

-- CreateIndex
CREATE INDEX "TravelProposal_proposalStatus_idx" ON "TravelProposal"("proposalStatus");

-- CreateIndex
CREATE INDEX "TravelProposal_deletedAt_idx" ON "TravelProposal"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSnapshot_proposalId_versionNumber_key" ON "ProposalSnapshot"("proposalId", "versionNumber");

-- CreateIndex
CREATE INDEX "ProposalSnapshot_proposalId_idx" ON "ProposalSnapshot"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalHistory_proposalId_idx" ON "ProposalHistory"("proposalId");

-- AddForeignKey
ALTER TABLE "TravelProposal" ADD CONSTRAINT "TravelProposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelProposal" ADD CONSTRAINT "TravelProposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelProposal" ADD CONSTRAINT "TravelProposal_travelRequirementId_fkey" FOREIGN KEY ("travelRequirementId") REFERENCES "TravelRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSnapshot" ADD CONSTRAINT "ProposalSnapshot_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TravelProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHistory" ADD CONSTRAINT "ProposalHistory_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TravelProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
