-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "photoIsDocument" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoThumb" BYTEA;

