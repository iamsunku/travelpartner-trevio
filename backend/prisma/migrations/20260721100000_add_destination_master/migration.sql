-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "language" TEXT,
    "timeZone" TEXT,
    "visaRequired" BOOLEAN NOT NULL DEFAULT false,
    "visaDetails" TEXT,
    "passportValidity" TEXT,
    "bestTimeToVisit" TEXT,
    "climate" TEXT,
    "averageBudget" TEXT,
    "popularAttractions" JSONB NOT NULL DEFAULT '[]',
    "localTransport" TEXT,
    "foodSpecialities" JSONB NOT NULL DEFAULT '[]',
    "shopping" TEXT,
    "nightlife" TEXT,
    "adventureActivities" JSONB NOT NULL DEFAULT '[]',
    "familyFriendly" BOOLEAN NOT NULL DEFAULT true,
    "coupleFriendly" BOOLEAN NOT NULL DEFAULT true,
    "seniorFriendly" BOOLEAN NOT NULL DEFAULT false,
    "heroImage" TEXT,
    "galleryImages" JSONB NOT NULL DEFAULT '[]',
    "bannerImage" TEXT,
    "thumbnail" TEXT,
    "videoUrl" TEXT,
    "imageAltText" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Destination_agencyId_idx" ON "Destination"("agencyId");

-- CreateIndex
CREATE INDEX "Destination_branchId_idx" ON "Destination"("branchId");

-- CreateIndex
CREATE INDEX "Destination_country_idx" ON "Destination"("country");

-- CreateIndex
CREATE INDEX "Destination_region_idx" ON "Destination"("region");

-- CreateIndex
CREATE INDEX "Destination_status_idx" ON "Destination"("status");

-- CreateIndex
CREATE INDEX "Destination_deletedAt_idx" ON "Destination"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_agencyId_slug_key" ON "Destination"("agencyId", "slug");
