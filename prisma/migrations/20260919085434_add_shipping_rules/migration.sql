-- CreateTable
CREATE TABLE "ShippingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSubtotal" DECIMAL(10,2) NOT NULL,
    "charge" DECIMAL(10,2) NOT NULL,
    "codExtraCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingRule_isActive_minSubtotal_idx" ON "ShippingRule"("isActive", "minSubtotal");
