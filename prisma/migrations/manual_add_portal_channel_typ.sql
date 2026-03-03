-- Add PORTAL to ChannelTyp enum
ALTER TYPE "ChannelTyp" ADD VALUE IF NOT EXISTS 'PORTAL';

-- Add mandantUserId column to channels table
ALTER TABLE "channels" ADD COLUMN "mandantUserId" TEXT;

-- Drop the existing unique constraint on akteId (was 1:1 for AKTE channels)
-- The constraint name may vary; drop by column if named constraint doesn't exist
ALTER TABLE "channels" DROP CONSTRAINT IF EXISTS "channels_akteId_key";

-- Add compound unique index for akteId + typ + mandantUserId
-- This ensures: one AKTE channel per Akte, one PORTAL channel per Mandant+Akte pair
CREATE UNIQUE INDEX "channel_akte_typ_mandant" ON "channels" ("akteId", "typ", "mandantUserId");

-- Add index on mandantUserId for efficient lookups
CREATE INDEX "channels_mandantUserId_idx" ON "channels" ("mandantUserId");

-- Add FK constraint for mandantUserId -> users.id
ALTER TABLE "channels"
  ADD CONSTRAINT "channels_mandantUserId_fkey"
  FOREIGN KEY ("mandantUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
