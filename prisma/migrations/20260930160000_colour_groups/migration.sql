-- DropIndex
DROP INDEX "Product_isReadymade_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colourName" TEXT,
ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_groupId_idx" ON "Product"("groupId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
