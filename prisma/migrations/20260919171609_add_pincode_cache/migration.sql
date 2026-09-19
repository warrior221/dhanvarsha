-- CreateTable
CREATE TABLE "PincodeArea" (
    "pincode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "areas" TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PincodeArea_pkey" PRIMARY KEY ("pincode")
);
