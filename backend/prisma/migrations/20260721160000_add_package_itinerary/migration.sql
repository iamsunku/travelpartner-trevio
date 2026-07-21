-- CreateTable
CREATE TABLE "PackageDay" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mealPlan" JSONB NOT NULL DEFAULT '{}',
    "coverImage" TEXT,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTimelineItem" (
    "id" TEXT NOT NULL,
    "packageDayId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "referenceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageTimelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageDay_packageId_dayNumber_key" ON "PackageDay"("packageId", "dayNumber");

-- CreateIndex
CREATE INDEX "PackageDay_packageId_idx" ON "PackageDay"("packageId");

-- CreateIndex
CREATE INDEX "PackageTimelineItem_packageDayId_idx" ON "PackageTimelineItem"("packageDayId");

-- CreateIndex
CREATE INDEX "PackageTimelineItem_itemType_idx" ON "PackageTimelineItem"("itemType");

-- AddForeignKey
ALTER TABLE "PackageDay" ADD CONSTRAINT "PackageDay_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageTimelineItem" ADD CONSTRAINT "PackageTimelineItem_packageDayId_fkey" FOREIGN KEY ("packageDayId") REFERENCES "PackageDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
