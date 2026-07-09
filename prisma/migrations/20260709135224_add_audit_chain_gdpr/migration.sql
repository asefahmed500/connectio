-- CreateEnum
CREATE TYPE "ErasureStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DATA_EXPORT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'DATA_EXPORT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'ERASURE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'ERASURE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'ERASURE_DENIED';
ALTER TYPE "NotificationType" ADD VALUE 'AUDIT_CHAIN_BROKEN';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previousHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ErasureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ErasureStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErasureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErasureRequest_userId_key" ON "ErasureRequest"("userId");

-- CreateIndex
CREATE INDEX "ErasureRequest_status_idx" ON "ErasureRequest"("status");

-- CreateIndex
CREATE INDEX "AuditLog_previousHash_idx" ON "AuditLog"("previousHash");

-- AddForeignKey
ALTER TABLE "ErasureRequest" ADD CONSTRAINT "ErasureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
