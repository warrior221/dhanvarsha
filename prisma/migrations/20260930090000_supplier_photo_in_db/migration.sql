-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "photoFileId",
ADD COLUMN     "photo" BYTEA,
ADD COLUMN     "photoMimeType" TEXT,
ADD COLUMN     "photoUpdatedAt" TIMESTAMP(3);

