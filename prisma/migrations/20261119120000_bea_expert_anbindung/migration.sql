-- CreateEnum
CREATE TYPE "BeaZertifikatStatus" AS ENUM ('AKTIV', 'FEHLER');

-- CreateEnum
CREATE TYPE "BeaRichtung" AS ENUM ('EINGANG', 'AUSGANG');

-- AlterTable
ALTER TABLE "bea_nachrichten" ADD COLUMN     "aktenzeichenAbsender" TEXT,
ADD COLUMN     "aktenzeichenJustiz" TEXT,
ADD COLUMN     "eebAngefordert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exportPfad" TEXT,
ADD COLUMN     "postfachSafeId" TEXT,
ADD COLUMN     "richtung" "BeaRichtung" NOT NULL DEFAULT 'EINGANG',
ADD COLUMN     "xjustizNachrichtenId" TEXT;

-- CreateTable
CREATE TABLE "bea_zertifikate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "p12Verschluesselt" TEXT NOT NULL,
    "pinVerschluesselt" TEXT NOT NULL,
    "seriennummer" TEXT NOT NULL,
    "inhaber" TEXT NOT NULL,
    "gueltigBis" TIMESTAMP(3) NOT NULL,
    "safeId" TEXT,
    "status" "BeaZertifikatStatus" NOT NULL DEFAULT 'AKTIV',
    "letzterFehler" TEXT,
    "letzterAbruf" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bea_zertifikate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bea_zertifikate_userId_key" ON "bea_zertifikate"("userId");

-- AddForeignKey
ALTER TABLE "bea_zertifikate" ADD CONSTRAINT "bea_zertifikate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

