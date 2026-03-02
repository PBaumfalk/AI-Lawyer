-- Phase 35: Bossfight schema
-- Apply manually: psql -d ailawyer -f prisma/migrations/manual_bossfight_schema.sql

-- BossfightStatus enum
DO $$ BEGIN
  CREATE TYPE "BossfightStatus" AS ENUM ('ACTIVE', 'DEFEATED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Bossfight table
CREATE TABLE IF NOT EXISTS "bossfights" (
  "id" TEXT NOT NULL,
  "kanzleiId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "spawnHp" INTEGER NOT NULL,
  "currentHp" INTEGER NOT NULL,
  "phase" INTEGER NOT NULL DEFAULT 1,
  "status" "BossfightStatus" NOT NULL DEFAULT 'ACTIVE',
  "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "defeatedAt" TIMESTAMP(3),
  "phaseRewardsGiven" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "bossfights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bossfights_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bossfights_kanzleiId_status_idx" ON "bossfights"("kanzleiId", "status");

-- BossfightDamage table
CREATE TABLE IF NOT EXISTS "bossfight_damages" (
  "id" TEXT NOT NULL,
  "bossfightId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 1,
  "runenEarned" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bossfight_damages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bossfight_damages_bossfightId_fkey" FOREIGN KEY ("bossfightId") REFERENCES "bossfights"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bossfight_damages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bossfight_damages_bossfightId_userId_idx" ON "bossfight_damages"("bossfightId", "userId");
CREATE INDEX IF NOT EXISTS "bossfight_damages_bossfightId_createdAt_idx" ON "bossfight_damages"("bossfightId", "createdAt");

-- Add trophies JSON field to UserGameProfile
ALTER TABLE "user_game_profiles" ADD COLUMN IF NOT EXISTS "trophies" JSONB NOT NULL DEFAULT '[]';
