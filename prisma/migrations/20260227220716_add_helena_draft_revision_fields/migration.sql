-- AlterTable: Add revision tracking fields to helena_drafts
ALTER TABLE "helena_drafts" ADD COLUMN "parentDraftId" TEXT;
ALTER TABLE "helena_drafts" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "helena_drafts" ADD COLUMN "feedbackCategories" TEXT[];
ALTER TABLE "helena_drafts" ADD COLUMN "noRevise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "helena_drafts" ADD COLUMN "undoExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "helena_drafts_parentDraftId_idx" ON "helena_drafts"("parentDraftId");

-- AddForeignKey
ALTER TABLE "helena_drafts" ADD CONSTRAINT "helena_drafts_parentDraftId_fkey" FOREIGN KEY ("parentDraftId") REFERENCES "helena_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
