-- CreateEnum
CREATE TYPE "CalDavProvider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "CalDavSyncStatus" AS ENUM ('GETRENNT', 'VERBUNDEN', 'FEHLER', 'SYNCHRONISIEREND');

-- CreateTable
CREATE TABLE "caldav_konten" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalDavProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "benutzername" TEXT NOT NULL,
    "passwortEnc" TEXT,
    "oauthTokens" JSONB,
    "authTyp" "EmailAuthTyp" NOT NULL DEFAULT 'PASSWORT',
    "selectedCalendarUrl" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" "CalDavSyncStatus" NOT NULL DEFAULT 'GETRENNT',
    "letzterSync" TIMESTAMP(3),
    "ctag" TEXT,
    "fehlerLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caldav_konten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caldav_sync_mappings" (
    "id" TEXT NOT NULL,
    "kontoId" TEXT NOT NULL,
    "kalenderEintragId" TEXT,
    "externalUid" TEXT NOT NULL,
    "etag" TEXT,
    "richtung" TEXT NOT NULL,
    "externalData" JSONB,
    "letzterSync" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caldav_sync_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caldav_konten_userId_idx" ON "caldav_konten"("userId");

-- CreateIndex
CREATE INDEX "caldav_sync_mappings_kontoId_idx" ON "caldav_sync_mappings"("kontoId");

-- CreateIndex
CREATE UNIQUE INDEX "caldav_sync_mappings_kontoId_externalUid_key" ON "caldav_sync_mappings"("kontoId", "externalUid");

-- CreateIndex
CREATE UNIQUE INDEX "caldav_sync_mappings_kontoId_kalenderEintragId_key" ON "caldav_sync_mappings"("kontoId", "kalenderEintragId");

-- AddForeignKey
ALTER TABLE "caldav_konten" ADD CONSTRAINT "caldav_konten_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caldav_sync_mappings" ADD CONSTRAINT "caldav_sync_mappings_kontoId_fkey" FOREIGN KEY ("kontoId") REFERENCES "caldav_konten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caldav_sync_mappings" ADD CONSTRAINT "caldav_sync_mappings_kalenderEintragId_fkey" FOREIGN KEY ("kalenderEintragId") REFERENCES "kalender_eintraege"("id") ON DELETE SET NULL ON UPDATE CASCADE;
