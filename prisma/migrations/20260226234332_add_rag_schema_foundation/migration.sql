-- CreateEnum
CREATE TYPE "ChunkType" AS ENUM ('STANDALONE', 'PARENT', 'CHILD');

-- CreateEnum
CREATE TYPE "MusterNerStatus" AS ENUM ('PENDING_NER', 'NER_RUNNING', 'INDEXED', 'REJECTED_PII_DETECTED');

-- AlterTable
ALTER TABLE "document_chunks" ADD COLUMN     "chunkType" "ChunkType" NOT NULL DEFAULT 'STANDALONE',
ADD COLUMN     "parentChunkId" TEXT;

-- CreateTable
CREATE TABLE "law_chunks" (
    "id" TEXT NOT NULL,
    "gesetzKuerzel" TEXT NOT NULL,
    "paragraphNr" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentContent" TEXT,
    "embedding" vector(1024),
    "modelVersion" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,

    CONSTRAINT "law_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urteil_chunks" (
    "id" TEXT NOT NULL,
    "aktenzeichen" TEXT NOT NULL,
    "gericht" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "rechtsgebiet" TEXT,
    "content" TEXT NOT NULL,
    "parentContent" TEXT,
    "embedding" vector(1024),
    "modelVersion" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "piiFiltered" BOOLEAN NOT NULL DEFAULT false,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "urteil_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" TEXT NOT NULL,
    "beschreibung" TEXT,
    "minioKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "nerStatus" "MusterNerStatus" NOT NULL DEFAULT 'PENDING_NER',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "muster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muster_chunks" (
    "id" TEXT NOT NULL,
    "musterId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "parentContent" TEXT,
    "embedding" vector(1024),
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "muster_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akte_normen" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "gesetzKuerzel" TEXT NOT NULL,
    "paragraphNr" TEXT NOT NULL,
    "anmerkung" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akte_normen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "law_chunks_gesetzKuerzel_idx" ON "law_chunks"("gesetzKuerzel");

-- CreateIndex
CREATE INDEX "law_chunks_paragraphNr_idx" ON "law_chunks"("paragraphNr");

-- CreateIndex
CREATE UNIQUE INDEX "urteil_chunks_sourceUrl_key" ON "urteil_chunks"("sourceUrl");

-- CreateIndex
CREATE INDEX "urteil_chunks_gericht_idx" ON "urteil_chunks"("gericht");

-- CreateIndex
CREATE INDEX "urteil_chunks_datum_idx" ON "urteil_chunks"("datum");

-- CreateIndex
CREATE INDEX "urteil_chunks_rechtsgebiet_idx" ON "urteil_chunks"("rechtsgebiet");

-- CreateIndex
CREATE INDEX "muster_nerStatus_idx" ON "muster"("nerStatus");

-- CreateIndex
CREATE INDEX "muster_chunks_musterId_idx" ON "muster_chunks"("musterId");

-- CreateIndex
CREATE UNIQUE INDEX "muster_chunks_musterId_chunkIndex_key" ON "muster_chunks"("musterId", "chunkIndex");

-- CreateIndex
CREATE INDEX "akte_normen_akteId_idx" ON "akte_normen"("akteId");

-- CreateIndex
CREATE UNIQUE INDEX "akte_normen_akteId_gesetzKuerzel_paragraphNr_key" ON "akte_normen"("akteId", "gesetzKuerzel", "paragraphNr");

-- CreateIndex
CREATE INDEX "document_chunks_parentChunkId_idx" ON "document_chunks"("parentChunkId");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_parentChunkId_fkey" FOREIGN KEY ("parentChunkId") REFERENCES "document_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster" ADD CONSTRAINT "muster_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_chunks" ADD CONSTRAINT "muster_chunks_musterId_fkey" FOREIGN KEY ("musterId") REFERENCES "muster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akte_normen" ADD CONSTRAINT "akte_normen_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akte_normen" ADD CONSTRAINT "akte_normen_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
