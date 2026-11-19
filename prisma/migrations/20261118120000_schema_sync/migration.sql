-- Schema-Sync: holt alle Schemaänderungen nach, die bisher nur per `prisma db push`
-- oder über manual_*.sql-Dateien in Datenbanken kamen (Portal, Gamification,
-- Anti-Missbrauch, Item-Shop, Bossfight, Einladungs- und Reset-Felder).
--
-- Bewusst idempotent: Bestehende Installationen haben Teile davon bereits.
-- Auf einer frischen Datenbank ergibt diese Migration exakt schema.prisma
-- (geprüft durch tests/integration/schema-drift.test.ts).

CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "PortalInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BossfightStatus" AS ENUM ('ACTIVE', 'DEFEATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AuditStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ItemTyp" AS ENUM ('AVATAR_RAHMEN', 'BANNER', 'PROFIL_TITEL', 'ABSCHLUSS_ANIMATION', 'PERK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "AktenActivityTyp" ADD VALUE IF NOT EXISTS 'TELEFONNOTIZ';
ALTER TYPE "AktenActivityTyp" ADD VALUE IF NOT EXISTS 'AUFGABE';
ALTER TYPE "ChannelTyp" ADD VALUE IF NOT EXISTS 'PORTAL';
ALTER TYPE "KalenderTyp" ADD VALUE IF NOT EXISTS 'FOKUSZEIT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANDANT';

-- ─── Spalten ──────────────────────────────────────────────────────────────
ALTER TABLE "akten" ADD COLUMN IF NOT EXISTS "naechsteSchritte" TEXT;
ALTER TABLE "akten" ADD COLUMN IF NOT EXISTS "summaryEmbedding" vector(1024);
ALTER TABLE "akten" ADD COLUMN IF NOT EXISTS "summaryEmbeddingAt" TIMESTAMP(3);
ALTER TABLE "akten" ALTER COLUMN "summaryEmbeddingAt" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "akten_activities" ADD COLUMN IF NOT EXISTS "mandantSichtbar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dokumente" ADD COLUMN IF NOT EXISTS "mandantSichtbar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "briefkoepfe" ALTER COLUMN "anwaelte" DROP DEFAULT;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "mandantUserId" TEXT;

ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "auditStatus" "AuditStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "pendingRunen" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "pendingXp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "completedDate" DATE;
UPDATE "quest_completions" SET "completedDate" = DATE("completedAt") WHERE "completedDate" IS NULL;
ALTER TABLE "quest_completions" ALTER COLUMN "completedDate" SET NOT NULL;

ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "endDatum" TIMESTAMP(3);
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "klasse" "SpielKlasse";
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "startDatum" TIMESTAMP(3);

ALTER TABLE "user_game_profiles" ADD COLUMN IF NOT EXISTS "badges" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "user_game_profiles" ADD COLUMN IF NOT EXISTS "trophies" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kontaktId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;

-- ─── Tabellen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "portal_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "beteiligteId" TEXT NOT NULL,
    "kontaktId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "PortalInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shop_items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "typ" "ItemTyp" NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "preis" INTEGER NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_inventory_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopItemId" TEXT NOT NULL,
    "ausgeruestet" BOOLEAN NOT NULL DEFAULT false,
    "verbraucht" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "usedForDate" TIMESTAMP(3),
    CONSTRAINT "user_inventory_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "user_inventory_items" ADD COLUMN IF NOT EXISTS "usedForDate" TIMESTAMP(3);
ALTER TABLE "user_inventory_items" ALTER COLUMN "usedForDate" SET DATA TYPE TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "weekly_snapshots" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_snapshots_pkey" PRIMARY KEY ("id")
);

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
    CONSTRAINT "bossfights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bossfight_damages" (
    "id" TEXT NOT NULL,
    "bossfightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "runenEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bossfight_damages_pkey" PRIMARY KEY ("id")
);

-- ─── Indizes ──────────────────────────────────────────────────────────────
-- Akte darf mehrere Kanäle haben (AKTE + je Mandant ein PORTAL-Kanal)
ALTER TABLE "channels" DROP CONSTRAINT IF EXISTS "channels_akteId_key";
DROP INDEX IF EXISTS "channels_akteId_key";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'channel_akte_typ_mandant')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'channels_akteId_typ_mandantUserId_key') THEN
    ALTER INDEX "channel_akte_typ_mandant" RENAME TO "channels_akteId_typ_mandantUserId_key";
  END IF;
END $$;
DROP INDEX IF EXISTS "channel_akte_typ_mandant";
CREATE UNIQUE INDEX IF NOT EXISTS "channels_akteId_typ_mandantUserId_key" ON "channels"("akteId", "typ", "mandantUserId");
CREATE INDEX IF NOT EXISTS "channels_mandantUserId_idx" ON "channels"("mandantUserId");

DROP INDEX IF EXISTS "quest_completions_userId_questId_completedAt_key";
CREATE UNIQUE INDEX IF NOT EXISTS "quest_completions_userId_questId_completedDate_key" ON "quest_completions"("userId", "questId", "completedDate");
DROP INDEX IF EXISTS "quests_typ_aktiv_idx";
CREATE INDEX IF NOT EXISTS "quests_typ_aktiv_klasse_idx" ON "quests"("typ", "aktiv", "klasse");

CREATE UNIQUE INDEX IF NOT EXISTS "portal_invites_token_key" ON "portal_invites"("token");
CREATE INDEX IF NOT EXISTS "portal_invites_token_idx" ON "portal_invites"("token");
CREATE INDEX IF NOT EXISTS "portal_invites_beteiligteId_idx" ON "portal_invites"("beteiligteId");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_items_slug_key" ON "shop_items"("slug");
CREATE INDEX IF NOT EXISTS "shop_items_typ_aktiv_idx" ON "shop_items"("typ", "aktiv");
CREATE INDEX IF NOT EXISTS "shop_items_rarity_idx" ON "shop_items"("rarity");
CREATE INDEX IF NOT EXISTS "user_inventory_items_userId_shopItemId_idx" ON "user_inventory_items"("userId", "shopItemId");
CREATE INDEX IF NOT EXISTS "user_inventory_items_userId_ausgeruestet_idx" ON "user_inventory_items"("userId", "ausgeruestet");
CREATE INDEX IF NOT EXISTS "weekly_snapshots_weekStart_idx" ON "weekly_snapshots"("weekStart");
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_snapshots_model_weekStart_userId_key" ON "weekly_snapshots"("model", "weekStart", "userId");
CREATE INDEX IF NOT EXISTS "bossfights_kanzleiId_status_idx" ON "bossfights"("kanzleiId", "status");
CREATE INDEX IF NOT EXISTS "bossfight_damages_bossfightId_userId_idx" ON "bossfight_damages"("bossfightId", "userId");
CREATE INDEX IF NOT EXISTS "bossfight_damages_bossfightId_createdAt_idx" ON "bossfight_damages"("bossfightId", "createdAt");
CREATE INDEX IF NOT EXISTS "akten_activities_akteId_mandantSichtbar_createdAt_idx" ON "akten_activities"("akteId", "mandantSichtbar", "createdAt");
CREATE INDEX IF NOT EXISTS "dokumente_akteId_mandantSichtbar_idx" ON "dokumente"("akteId", "mandantSichtbar");
CREATE UNIQUE INDEX IF NOT EXISTS "users_inviteToken_key" ON "users"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "users_kontaktId_key" ON "users"("kontaktId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- ─── Fremdschlüssel ───────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_beteiligteId_fkey" FOREIGN KEY ("beteiligteId") REFERENCES "beteiligte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_kontaktId_fkey" FOREIGN KEY ("kontaktId") REFERENCES "kontakte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "channels" ADD CONSTRAINT "channels_mandantUserId_fkey" FOREIGN KEY ("mandantUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_inventory_items" ADD CONSTRAINT "user_inventory_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_inventory_items" ADD CONSTRAINT "user_inventory_items_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "bossfights" ADD CONSTRAINT "bossfights_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "bossfight_damages" ADD CONSTRAINT "bossfight_damages_bossfightId_fkey" FOREIGN KEY ("bossfightId") REFERENCES "bossfights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "bossfight_damages" ADD CONSTRAINT "bossfight_damages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
