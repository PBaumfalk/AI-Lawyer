-- Add missing TOTP columns for users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpVerifiedAt" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totpNonce" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_totpNonce_key" ON "users"("totpNonce");
