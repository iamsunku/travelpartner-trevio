-- CreateTable
CREATE TABLE "ApiMetric" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "userId" TEXT,
    "agencyId" TEXT,
    "errorMessage" TEXT,
    "queryTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiMetric_endpoint_idx" ON "ApiMetric"("endpoint");

-- CreateIndex
CREATE INDEX "ApiMetric_method_idx" ON "ApiMetric"("method");

-- CreateIndex
CREATE INDEX "ApiMetric_statusCode_idx" ON "ApiMetric"("statusCode");

-- CreateIndex
CREATE INDEX "ApiMetric_userId_idx" ON "ApiMetric"("userId");

-- CreateIndex
CREATE INDEX "ApiMetric_agencyId_idx" ON "ApiMetric"("agencyId");

-- CreateIndex
CREATE INDEX "ApiMetric_createdAt_idx" ON "ApiMetric"("createdAt");

-- CreateIndex
CREATE INDEX "PerformanceMetric_metric_idx" ON "PerformanceMetric"("metric");

-- CreateIndex
CREATE INDEX "PerformanceMetric_date_idx" ON "PerformanceMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetric_metric_date_hour_key" ON "PerformanceMetric"("metric", "date", "hour");
