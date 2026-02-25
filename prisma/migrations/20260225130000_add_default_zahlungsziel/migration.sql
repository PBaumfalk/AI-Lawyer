-- Add defaultZahlungszielTage column to kanzleien table
ALTER TABLE "kanzleien" ADD COLUMN "defaultZahlungszielTage" INTEGER NOT NULL DEFAULT 14;
