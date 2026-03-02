-- CreateEnum
CREATE TYPE "SpielKlasse" AS ENUM ('JURIST', 'SCHREIBER', 'WAECHTER', 'QUARTIERMEISTER');

-- CreateEnum
CREATE TYPE "QuestTyp" AS ENUM ('DAILY', 'WEEKLY', 'SPECIAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "gamificationOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_game_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "klasse" "SpielKlasse" NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "runen" INTEGER NOT NULL DEFAULT 0,
    "streakTage" INTEGER NOT NULL DEFAULT 0,
    "streakLetzte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_game_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "typ" "QuestTyp" NOT NULL DEFAULT 'DAILY',
    "bedingung" JSONB NOT NULL,
    "xpBelohnung" INTEGER NOT NULL DEFAULT 0,
    "runenBelohnung" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "xpVerdient" INTEGER NOT NULL,
    "runenVerdient" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_game_profiles_userId_key" ON "user_game_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_game_profiles_userId_idx" ON "user_game_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "quests_name_typ_key" ON "quests"("name", "typ");

-- CreateIndex
CREATE INDEX "quests_typ_aktiv_idx" ON "quests"("typ", "aktiv");

-- CreateIndex
CREATE INDEX "quest_completions_userId_completedAt_idx" ON "quest_completions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "quest_completions_questId_idx" ON "quest_completions"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "quest_completions_userId_questId_completedAt_key" ON "quest_completions"("userId", "questId", "completedAt");

-- AddForeignKey
ALTER TABLE "user_game_profiles" ADD CONSTRAINT "user_game_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_game_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
