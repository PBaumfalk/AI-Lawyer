-- AlterTable: Add anwaelte (lawyer names) column to briefkoepfe
-- Required by BRAO/BORA for German law firm letterheads
ALTER TABLE "briefkoepfe" ADD COLUMN "anwaelte" TEXT[] NOT NULL DEFAULT '{}';
