-- Sessions issued before this instant are rejected (password change/reset).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionsGueltigAb" TIMESTAMP(3);
