-- Add missing portal and password reset columns for users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kontaktId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_inviteToken_key" ON "users"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "users_kontaktId_key" ON "users"("kontaktId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_passwordResetToken_key" ON "users"("passwordResetToken");
