-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SSO_PROVIDER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'SSO_PROVIDER_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'SSO_PROVIDER_DELETED';
ALTER TYPE "NotificationType" ADD VALUE 'SSO_LOGIN_SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'SSO_LOGIN_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'SCIM_USER_PROVISIONED';
ALTER TYPE "NotificationType" ADD VALUE 'SCIM_USER_DEPROVISIONED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ssoProviderId" TEXT;

-- CreateTable
CREATE TABLE "SsoProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "idpEntityId" TEXT,
    "idpSsoUrl" TEXT,
    "idpCertificate" TEXT,
    "spEntityId" TEXT NOT NULL DEFAULT 'urn:connectio:sso',
    "spAcsUrl" TEXT,
    "oidcIssuer" TEXT,
    "oidcDiscoveryUrl" TEXT,
    "oidcClientId" TEXT,
    "oidcClientSecret" TEXT,
    "attributeMapping" JSONB,
    "jitProvisioning" BOOLEAN NOT NULL DEFAULT true,
    "defaultRole" "UserRole" NOT NULL DEFAULT 'TEAM_MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScimApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SsoProvider_isActive_idx" ON "SsoProvider"("isActive");

-- CreateIndex
CREATE INDEX "SsoProvider_providerType_idx" ON "SsoProvider"("providerType");

-- CreateIndex
CREATE INDEX "ScimApiKey_keyHash_idx" ON "ScimApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ScimApiKey_isActive_idx" ON "ScimApiKey"("isActive");

-- CreateIndex
CREATE INDEX "User_ssoProviderId_idx" ON "User"("ssoProviderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ssoProviderId_fkey" FOREIGN KEY ("ssoProviderId") REFERENCES "SsoProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
