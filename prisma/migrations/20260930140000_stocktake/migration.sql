-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('OPEN', 'COUNTED', 'CLOSED', 'ABANDONED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "stocktakeLineId" TEXT;

-- CreateTable
CREATE TABLE "Stocktake" (
    "id" TEXT NOT NULL,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Stocktake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeLine" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "variantId" TEXT,
    "scannedCode" TEXT,
    "countedQty" INTEGER NOT NULL DEFAULT 0,
    "expectedQty" INTEGER,
    "skippedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StocktakeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stocktake_status_startedAt_idx" ON "Stocktake"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Stocktake_startedAt_idx" ON "Stocktake"("startedAt");

-- CreateIndex
CREATE INDEX "StocktakeLine_stocktakeId_idx" ON "StocktakeLine"("stocktakeId");

-- CreateIndex
CREATE INDEX "StocktakeLine_variantId_idx" ON "StocktakeLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeLine_stocktakeId_variantId_key" ON "StocktakeLine"("stocktakeId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeLine_stocktakeId_scannedCode_key" ON "StocktakeLine"("stocktakeId", "scannedCode");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_stocktakeLineId_key" ON "StockMovement"("stocktakeLineId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stocktakeLineId_fkey" FOREIGN KEY ("stocktakeLineId") REFERENCES "StocktakeLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

