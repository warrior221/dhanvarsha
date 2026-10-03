-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sku";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "sku",
ALTER COLUMN "barcode" SET NOT NULL;

