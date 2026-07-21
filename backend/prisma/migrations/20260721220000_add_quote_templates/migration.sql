-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "templateName" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'Classic',
    "primaryColor" TEXT NOT NULL DEFAULT '#2A7BBD',
    "secondaryColor" TEXT NOT NULL DEFAULT '#00A79D',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "logo" TEXT,
    "watermark" TEXT,
    "headerStyle" JSONB NOT NULL DEFAULT '{}',
    "footerStyle" JSONB NOT NULL DEFAULT '{}',
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "backgroundImage" TEXT,
    "showPageNumbers" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "customTitle" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateHistory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteTemplateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyBranding" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#2A7BBD',
    "secondaryColor" TEXT NOT NULL DEFAULT '#00A79D',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "logo" TEXT,
    "watermark" TEXT,
    "footerText" TEXT,
    "backgroundImage" TEXT,
    "headerHtml" TEXT,
    "showPageNumbers" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteTemplate_agencyId_idx" ON "QuoteTemplate"("agencyId");

-- CreateIndex
CREATE INDEX "QuoteTemplate_status_idx" ON "QuoteTemplate"("status");

-- CreateIndex
CREATE INDEX "QuoteTemplate_deletedAt_idx" ON "QuoteTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "QuoteTemplateSection_templateId_idx" ON "QuoteTemplateSection"("templateId");

-- CreateIndex
CREATE INDEX "QuoteTemplateSection_sectionType_idx" ON "QuoteTemplateSection"("sectionType");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyBranding_agencyId_key" ON "AgencyBranding"("agencyId");

-- CreateIndex
CREATE INDEX "QuoteTemplateHistory_templateId_idx" ON "QuoteTemplateHistory"("templateId");

-- AddForeignKey
ALTER TABLE "QuoteTemplateSection" ADD CONSTRAINT "QuoteTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateHistory" ADD CONSTRAINT "QuoteTemplateHistory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
