-- CreateEnum
CREATE TYPE "ShopReviewSource" AS ENUM ('WEBSITE', 'GOOGLE');

-- CreateTable
CREATE TABLE "ShopReview" (
    "id" TEXT NOT NULL,
    "source" "ShopReviewSource" NOT NULL DEFAULT 'WEBSITE',
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "authorPhotoUrl" TEXT,
    "authorUrl" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopReview_externalId_key" ON "ShopReview"("externalId");

-- CreateIndex
CREATE INDEX "ShopReview_isPublished_reviewedAt_idx" ON "ShopReview"("isPublished", "reviewedAt");

-- AddForeignKey
ALTER TABLE "ShopReview" ADD CONSTRAINT "ShopReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
