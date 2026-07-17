-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "resetOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resetOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetOtpHash" TEXT;
