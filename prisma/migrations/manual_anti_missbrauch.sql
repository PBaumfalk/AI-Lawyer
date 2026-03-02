-- Phase 38: Anti-Missbrauch Schema Changes
BEGIN;

-- 1. Add AuditStatus enum
DO $$ BEGIN
  CREATE TYPE "AuditStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add new columns to quest_completions
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "pendingXp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "pendingRunen" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "auditStatus" "AuditStatus" NOT NULL DEFAULT 'NONE';

-- 3. Backfill completedDate from completedAt for existing rows
UPDATE "quest_completions" SET "completedDate" = DATE("completedAt") WHERE "completedDate" IS NULL;

-- 4. Make completedDate NOT NULL after backfill
ALTER TABLE "quest_completions" ALTER COLUMN "completedDate" SET NOT NULL;

-- 5. Replace unique constraint (DATE-level dedup replaces millisecond dedup)
-- Drop old unique index (completedAt-based)
DROP INDEX IF EXISTS "quest_completions_userId_questId_completedAt_key";
-- Create new unique index (completedDate-based, strictly stronger)
CREATE UNIQUE INDEX "quest_completions_userId_questId_completedDate_key"
  ON "quest_completions"("userId", "questId", "completedDate");

COMMIT;
