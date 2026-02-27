-- CreateEnum
CREATE TYPE "HelenaTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'WAITING_APPROVAL', 'ABGEBROCHEN');

-- CreateEnum
CREATE TYPE "HelenaDraftTyp" AS ENUM ('DOKUMENT', 'FRIST', 'NOTIZ', 'ALERT');

-- CreateEnum
CREATE TYPE "HelenaDraftStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EDITED');

-- CreateEnum
CREATE TYPE "HelenaAlertTyp" AS ENUM ('FRIST_KRITISCH', 'AKTE_INAKTIV', 'BETEILIGTE_FEHLEN', 'DOKUMENT_FEHLT', 'WIDERSPRUCH', 'NEUES_URTEIL');

-- CreateEnum
CREATE TYPE "AktenActivityTyp" AS ENUM ('DOKUMENT', 'FRIST', 'EMAIL', 'HELENA_DRAFT', 'HELENA_ALERT', 'NOTIZ', 'BETEILIGTE', 'STATUS_CHANGE');

-- CreateTable
CREATE TABLE "helena_tasks" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "auftrag" TEXT NOT NULL,
    "status" "HelenaTaskStatus" NOT NULL DEFAULT 'PENDING',
    "modus" TEXT NOT NULL DEFAULT 'BACKGROUND',
    "prioritaet" INTEGER NOT NULL DEFAULT 5,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "ergebnis" TEXT,
    "fehler" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helena_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helena_drafts" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typ" "HelenaDraftTyp" NOT NULL,
    "status" "HelenaDraftStatus" NOT NULL DEFAULT 'PENDING',
    "titel" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "meta" JSONB,
    "feedback" TEXT,
    "helenaTaskId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helena_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helena_alerts" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typ" "HelenaAlertTyp" NOT NULL,
    "titel" TEXT NOT NULL,
    "inhalt" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 5,
    "prioritaet" INTEGER NOT NULL DEFAULT 5,
    "meta" JSONB,
    "gelesen" BOOLEAN NOT NULL DEFAULT false,
    "gelesenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helena_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helena_memories" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helena_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akten_activities" (
    "id" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "userId" TEXT,
    "typ" "AktenActivityTyp" NOT NULL,
    "titel" TEXT NOT NULL,
    "inhalt" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akten_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "helena_tasks_akteId_status_idx" ON "helena_tasks"("akteId", "status");

-- CreateIndex
CREATE INDEX "helena_tasks_userId_status_idx" ON "helena_tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "helena_tasks_status_createdAt_idx" ON "helena_tasks"("status", "createdAt");

-- CreateIndex
CREATE INDEX "helena_drafts_akteId_status_idx" ON "helena_drafts"("akteId", "status");

-- CreateIndex
CREATE INDEX "helena_drafts_userId_status_idx" ON "helena_drafts"("userId", "status");

-- CreateIndex
CREATE INDEX "helena_drafts_status_createdAt_idx" ON "helena_drafts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "helena_alerts_akteId_typ_idx" ON "helena_alerts"("akteId", "typ");

-- CreateIndex
CREATE INDEX "helena_alerts_userId_gelesen_idx" ON "helena_alerts"("userId", "gelesen");

-- CreateIndex
CREATE INDEX "helena_alerts_typ_createdAt_idx" ON "helena_alerts"("typ", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "helena_memories_akteId_key" ON "helena_memories"("akteId");

-- CreateIndex
CREATE INDEX "akten_activities_akteId_createdAt_idx" ON "akten_activities"("akteId", "createdAt");

-- CreateIndex
CREATE INDEX "akten_activities_akteId_typ_idx" ON "akten_activities"("akteId", "typ");

-- AddForeignKey
ALTER TABLE "helena_tasks" ADD CONSTRAINT "helena_tasks_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_tasks" ADD CONSTRAINT "helena_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_drafts" ADD CONSTRAINT "helena_drafts_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_drafts" ADD CONSTRAINT "helena_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_drafts" ADD CONSTRAINT "helena_drafts_helenaTaskId_fkey" FOREIGN KEY ("helenaTaskId") REFERENCES "helena_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_drafts" ADD CONSTRAINT "helena_drafts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_alerts" ADD CONSTRAINT "helena_alerts_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_alerts" ADD CONSTRAINT "helena_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helena_memories" ADD CONSTRAINT "helena_memories_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten_activities" ADD CONSTRAINT "akten_activities_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akten_activities" ADD CONSTRAINT "akten_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
