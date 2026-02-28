-- CreateTable
CREATE TABLE "schriftsatz_retrieval_logs" (
    "id" TEXT NOT NULL,
    "schriftsatzId" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "retrievalBelege" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modell" TEXT NOT NULL,
    "recallAt5" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schriftsatz_retrieval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schriftsatz_retrieval_logs_schriftsatzId_idx" ON "schriftsatz_retrieval_logs"("schriftsatzId");

-- CreateIndex
CREATE INDEX "schriftsatz_retrieval_logs_createdAt_idx" ON "schriftsatz_retrieval_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "schriftsatz_retrieval_logs" ADD CONSTRAINT "schriftsatz_retrieval_logs_schriftsatzId_fkey" FOREIGN KEY ("schriftsatzId") REFERENCES "helena_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
