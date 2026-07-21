-- AlterTable
ALTER TABLE "TravelProposal" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "TravelProposal" ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMP(3);
ALTER TABLE "TravelProposal" ADD COLUMN IF NOT EXISTS "pdfVersion" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProposalPdf" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "generatedByName" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProposalPdf_proposalId_versionNumber_key" ON "ProposalPdf"("proposalId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ProposalPdf_proposalId_idx" ON "ProposalPdf"("proposalId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProposalPdf" ADD CONSTRAINT "ProposalPdf_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "TravelProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
