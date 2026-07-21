-- CreateTable
CREATE TABLE "TravelPackage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "branchId" TEXT,
    "packageCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "durationNights" INTEGER NOT NULL DEFAULT 0,
    "packageType" TEXT NOT NULL DEFAULT 'Standard',
    "description" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "startingPrice" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "heroImage" TEXT,
    "bannerImage" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "hotelCost" INTEGER NOT NULL DEFAULT 0,
    "activityCost" INTEGER NOT NULL DEFAULT 0,
    "transferCost" INTEGER NOT NULL DEFAULT 0,
    "markup" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "finalPrice" INTEGER NOT NULL DEFAULT 0,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageHotel" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "hotelProductId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageHotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageActivity" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "activityProductId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTransfer" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "transferProductId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageVersion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelPackage_agencyId_packageCode_key" ON "TravelPackage"("agencyId", "packageCode");

-- CreateIndex
CREATE INDEX "TravelPackage_agencyId_idx" ON "TravelPackage"("agencyId");

-- CreateIndex
CREATE INDEX "TravelPackage_destinationId_idx" ON "TravelPackage"("destinationId");

-- CreateIndex
CREATE INDEX "TravelPackage_status_idx" ON "TravelPackage"("status");

-- CreateIndex
CREATE INDEX "TravelPackage_packageType_idx" ON "TravelPackage"("packageType");

-- CreateIndex
CREATE INDEX "TravelPackage_isFeatured_idx" ON "TravelPackage"("isFeatured");

-- CreateIndex
CREATE INDEX "TravelPackage_deletedAt_idx" ON "TravelPackage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackageHotel_packageId_hotelProductId_key" ON "PackageHotel"("packageId", "hotelProductId");

-- CreateIndex
CREATE INDEX "PackageHotel_packageId_idx" ON "PackageHotel"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageActivity_packageId_activityProductId_key" ON "PackageActivity"("packageId", "activityProductId");

-- CreateIndex
CREATE INDEX "PackageActivity_packageId_idx" ON "PackageActivity"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageTransfer_packageId_transferProductId_key" ON "PackageTransfer"("packageId", "transferProductId");

-- CreateIndex
CREATE INDEX "PackageTransfer_packageId_idx" ON "PackageTransfer"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageVersion_packageId_versionNumber_key" ON "PackageVersion"("packageId", "versionNumber");

-- CreateIndex
CREATE INDEX "PackageVersion_packageId_idx" ON "PackageVersion"("packageId");

-- AddForeignKey
ALTER TABLE "TravelPackage" ADD CONSTRAINT "TravelPackage_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHotel" ADD CONSTRAINT "PackageHotel_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageHotel" ADD CONSTRAINT "PackageHotel_hotelProductId_fkey" FOREIGN KEY ("hotelProductId") REFERENCES "HotelProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivity" ADD CONSTRAINT "PackageActivity_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageActivity" ADD CONSTRAINT "PackageActivity_activityProductId_fkey" FOREIGN KEY ("activityProductId") REFERENCES "ActivityProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTransfer" ADD CONSTRAINT "PackageTransfer_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTransfer" ADD CONSTRAINT "PackageTransfer_transferProductId_fkey" FOREIGN KEY ("transferProductId") REFERENCES "TransferProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageVersion" ADD CONSTRAINT "PackageVersion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
