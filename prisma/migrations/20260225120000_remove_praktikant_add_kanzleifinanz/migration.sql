-- Step 1: Convert any PRAKTIKANT users to SACHBEARBEITER (must happen BEFORE enum value removal)
UPDATE "users" SET "role" = 'SACHBEARBEITER' WHERE "role" = 'PRAKTIKANT';

-- Step 2: Remove PRAKTIKANT from UserRole enum
-- Drop default first (PostgreSQL cannot auto-cast defaults during ALTER TYPE)
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'ANWALT', 'SACHBEARBEITER', 'SEKRETARIAT');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
-- Restore the default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SACHBEARBEITER';

-- Step 3: Add canSeeKanzleiFinanzen field
ALTER TABLE "users" ADD COLUMN "canSeeKanzleiFinanzen" BOOLEAN NOT NULL DEFAULT false;
