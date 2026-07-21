-- AlterTable
ALTER TABLE "PackageTimelineItem" ADD COLUMN "optionGroup" TEXT;

-- CreateTable
CREATE TABLE "PackageProductOption" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "optionGroup" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceAdjustment" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageProductOption_packageId_productType_productId_key" ON "PackageProductOption"("packageId", "productType", "productId");

-- CreateIndex
CREATE INDEX "PackageProductOption_packageId_idx" ON "PackageProductOption"("packageId");

-- CreateIndex
CREATE INDEX "PackageProductOption_packageId_productType_optionGroup_idx" ON "PackageProductOption"("packageId", "productType", "optionGroup");

-- AddForeignKey
ALTER TABLE "PackageProductOption" ADD CONSTRAINT "PackageProductOption_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing junction products into option groups
INSERT INTO "PackageProductOption" ("id", "packageId", "productType", "productId", "optionGroup", "isDefault", "sortOrder", "priceAdjustment", "status", "updatedAt")
SELECT
    gen_random_uuid()::text,
    h."packageId",
    'HOTEL',
    h."hotelProductId",
    'Standard',
    (ROW_NUMBER() OVER (PARTITION BY h."packageId" ORDER BY h."sortOrder") = 1),
    h."sortOrder",
    0,
    'Active',
    CURRENT_TIMESTAMP
FROM "PackageHotel" h;

INSERT INTO "PackageProductOption" ("id", "packageId", "productType", "productId", "optionGroup", "isDefault", "sortOrder", "priceAdjustment", "status", "updatedAt")
SELECT
    gen_random_uuid()::text,
    a."packageId",
    'ACTIVITY',
    a."activityProductId",
    'Included',
    (ROW_NUMBER() OVER (PARTITION BY a."packageId" ORDER BY a."sortOrder") = 1),
    a."sortOrder",
    0,
    'Active',
    CURRENT_TIMESTAMP
FROM "PackageActivity" a;

INSERT INTO "PackageProductOption" ("id", "packageId", "productType", "productId", "optionGroup", "isDefault", "sortOrder", "priceAdjustment", "status", "updatedAt")
SELECT
    gen_random_uuid()::text,
    t."packageId",
    'TRANSFER',
    t."transferProductId",
    'Shared',
    (ROW_NUMBER() OVER (PARTITION BY t."packageId" ORDER BY t."sortOrder") = 1),
    t."sortOrder",
    0,
    'Active',
    CURRENT_TIMESTAMP
FROM "PackageTransfer" t;
