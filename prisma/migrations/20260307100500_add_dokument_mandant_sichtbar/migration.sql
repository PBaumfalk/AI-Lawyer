-- Add missing mandantSichtbar for dokumente
ALTER TABLE "dokumente"
  ADD COLUMN IF NOT EXISTS "mandantSichtbar" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "dokumente_akteId_mandantSichtbar_idx"
  ON "dokumente"("akteId", "mandantSichtbar");
