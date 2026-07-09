-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backupCodes" TEXT[],
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpPendingSecret" TEXT,
ADD COLUMN     "totpSecret" TEXT;
