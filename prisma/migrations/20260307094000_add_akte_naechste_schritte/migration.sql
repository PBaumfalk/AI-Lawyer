-- Add missing naechsteSchritte column for Akte
ALTER TABLE "akten"
  ADD COLUMN IF NOT EXISTS "naechsteSchritte" TEXT;
