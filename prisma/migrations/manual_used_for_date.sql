-- Add usedForDate field to UserInventoryItem
-- Tracks which date a streak-schutz perk was consumed to protect
ALTER TABLE "user_inventory_items" ADD COLUMN IF NOT EXISTS "usedForDate" TIMESTAMP;
