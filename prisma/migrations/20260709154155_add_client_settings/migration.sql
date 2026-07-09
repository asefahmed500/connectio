-- CreateTable
CREATE TABLE "ClientSettings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "portalTitle" TEXT,
    "customDomain" TEXT,
    "customCss" TEXT,
    "hideBranding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSettings_clientId_key" ON "ClientSettings"("clientId");

-- AddForeignKey
ALTER TABLE "ClientSettings" ADD CONSTRAINT "ClientSettings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
