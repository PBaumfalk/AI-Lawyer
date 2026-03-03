-- Add badges JSON column to user_game_profiles
-- Stores earned badge slugs with earn dates: [{ slug: string, earnedAt: string }]
ALTER TABLE "user_game_profiles" ADD COLUMN IF NOT EXISTS "badges" JSONB NOT NULL DEFAULT '[]';
