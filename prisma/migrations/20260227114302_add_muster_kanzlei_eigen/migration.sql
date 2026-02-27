-- AlterTable: Add isKanzleiEigen to muster table
ALTER TABLE "muster" ADD COLUMN "isKanzleiEigen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add kanzleiEigen to muster_chunks table
ALTER TABLE "muster_chunks" ADD COLUMN "kanzleiEigen" BOOLEAN NOT NULL DEFAULT false;
