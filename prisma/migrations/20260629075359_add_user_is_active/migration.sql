-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'USER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_DELETED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_BLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_UNBLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_PASSWORD_RESET_BY_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
