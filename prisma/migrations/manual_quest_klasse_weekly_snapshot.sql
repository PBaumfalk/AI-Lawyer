-- Phase 37: Klassen + Weekly + Special Quests schema changes
-- Apply with: psql $DATABASE_URL -f prisma/migrations/manual_quest_klasse_weekly_snapshot.sql

-- 1. Add klasse, startDatum, endDatum to Quest model
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "klasse" "SpielKlasse";
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "startDatum" TIMESTAMP(3);
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "endDatum" TIMESTAMP(3);

-- 2. Replace existing index with composite klasse-aware index
DROP INDEX IF EXISTS "quests_typ_aktiv_idx";
CREATE INDEX IF NOT EXISTS "quests_typ_aktiv_klasse_idx" ON "quests"("typ", "aktiv", "klasse");

-- 3. Create WeeklySnapshot table
CREATE TABLE IF NOT EXISTS "weekly_snapshots" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_snapshots_pkey" PRIMARY KEY ("id")
);

-- 4. Create unique constraint and indexes for WeeklySnapshot
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_snapshots_model_weekStart_userId_key"
  ON "weekly_snapshots"("model", "weekStart", "userId");
CREATE INDEX IF NOT EXISTS "weekly_snapshots_weekStart_idx"
  ON "weekly_snapshots"("weekStart");
