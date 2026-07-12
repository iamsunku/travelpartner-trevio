-- Product catalog, international quotation fields, employee activity tracking

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelProduct" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "starCategory" INTEGER NOT NULL DEFAULT 3,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "mapsUrl" TEXT,
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "policies" JSONB NOT NULL DEFAULT '{}',
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "roomCategories" JSONB NOT NULL DEFAULT '[]',
    "contractStart" TEXT,
    "contractEnd" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "cancellationPolicy" TEXT,
    "blackoutDates" JSONB NOT NULL DEFAULT '[]',
    "inventory" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityProduct" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "duration" TEXT,
    "location" TEXT,
    "meetingPoint" TEXT,
    "inclusions" JSONB NOT NULL DEFAULT '[]',
    "exclusions" JSONB NOT NULL DEFAULT '[]',
    "operatingHours" TEXT,
    "minChildAge" INTEGER,
    "adultPrice" INTEGER NOT NULL DEFAULT 0,
    "childPrice" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "blackoutDates" JSONB NOT NULL DEFAULT '[]',
    "rateValidFrom" TEXT,
    "rateValidTo" TEXT,
    "cancellationPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivityProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransferProduct" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "vehicleType" TEXT,
    "pickupLocation" TEXT NOT NULL,
    "dropLocation" TEXT NOT NULL,
    "pickupTime" TEXT,
    "privatePrice" INTEGER,
    "sharedPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "rateValidFrom" TEXT,
    "rateValidTo" TEXT,
    "blackoutDates" JSONB NOT NULL DEFAULT '[]',
    "cancellationPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransferProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agencyId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeActivitySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT,
    "date" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3),
    "logoutAt" TIMESTAMP(3),
    "workingMinutes" INTEGER NOT NULL DEFAULT 0,
    "customersAdded" INTEGER NOT NULL DEFAULT 0,
    "quotationsCreated" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeActivitySnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quotation" ADD COLUMN "isInternational" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quotation" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "destination" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "travelDates" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "adults" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "children" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "infants" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "hotelStarPreference" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "location" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "budget" INTEGER;
ALTER TABLE "Quotation" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "Quotation" ADD COLUMN "packageIncludes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Quotation" ADD COLUMN "packageExcludes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Quotation" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "cancellationPolicy" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE "Quotation" ADD COLUMN "lineItems" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "Supplier_agencyId_idx" ON "Supplier"("agencyId");
CREATE INDEX "HotelProduct_agencyId_idx" ON "HotelProduct"("agencyId");
CREATE INDEX "HotelProduct_city_idx" ON "HotelProduct"("city");
CREATE INDEX "HotelProduct_status_idx" ON "HotelProduct"("status");
CREATE INDEX "ActivityProduct_agencyId_idx" ON "ActivityProduct"("agencyId");
CREATE INDEX "ActivityProduct_status_idx" ON "ActivityProduct"("status");
CREATE INDEX "TransferProduct_agencyId_idx" ON "TransferProduct"("agencyId");
CREATE INDEX "TransferProduct_status_idx" ON "TransferProduct"("status");
CREATE INDEX "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");
CREATE INDEX "CustomerDocument_agencyId_idx" ON "CustomerDocument"("agencyId");
CREATE UNIQUE INDEX "EmployeeActivitySnapshot_userId_date_key" ON "EmployeeActivitySnapshot"("userId", "date");
CREATE INDEX "EmployeeActivitySnapshot_agencyId_idx" ON "EmployeeActivitySnapshot"("agencyId");

ALTER TABLE "HotelProduct" ADD CONSTRAINT "HotelProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityProduct" ADD CONSTRAINT "ActivityProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransferProduct" ADD CONSTRAINT "TransferProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
