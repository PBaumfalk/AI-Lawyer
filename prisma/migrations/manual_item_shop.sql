-- Phase 39: Item-Shop + Inventar Schema
-- Must run outside transaction for PostgreSQL enum extension
DO $$ BEGIN
  ALTER TYPE "KalenderTyp" ADD VALUE IF NOT EXISTS 'FOKUSZEIT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

BEGIN;

-- 1. Create ItemRarity enum
DO $$ BEGIN
  CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create ItemTyp enum
DO $$ BEGIN
  CREATE TYPE "ItemTyp" AS ENUM ('AVATAR_RAHMEN', 'BANNER', 'PROFIL_TITEL', 'ABSCHLUSS_ANIMATION', 'PERK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create shop_items table
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

CREATE UNIQUE INDEX IF NOT EXISTS "shop_items_slug_key" ON "shop_items"("slug");
CREATE INDEX IF NOT EXISTS "shop_items_typ_aktiv_idx" ON "shop_items"("typ", "aktiv");
CREATE INDEX IF NOT EXISTS "shop_items_rarity_idx" ON "shop_items"("rarity");

-- 4. Create user_inventory_items table
CREATE TABLE IF NOT EXISTS "user_inventory_items" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shopItemId" TEXT NOT NULL,
  "ausgeruestet" BOOLEAN NOT NULL DEFAULT false,
  "verbraucht" BOOLEAN NOT NULL DEFAULT false,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),

  CONSTRAINT "user_inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_inventory_items_userId_shopItemId_idx" ON "user_inventory_items"("userId", "shopItemId");
CREATE INDEX IF NOT EXISTS "user_inventory_items_userId_ausgeruestet_idx" ON "user_inventory_items"("userId", "ausgeruestet");

-- Foreign keys (use IF NOT EXISTS pattern via exception handling)
DO $$ BEGIN
  ALTER TABLE "user_inventory_items" ADD CONSTRAINT "user_inventory_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_inventory_items" ADD CONSTRAINT "user_inventory_items_shopItemId_fkey"
    FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
