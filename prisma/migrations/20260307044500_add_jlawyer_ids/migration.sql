-- AlterTable
ALTER TABLE "akten" ADD COLUMN "jlawyerId" TEXT;

-- AlterTable
ALTER TABLE "kontakte" ADD COLUMN "jlawyerId" TEXT;

-- AlterTable
ALTER TABLE "kalender_eintraege" ADD COLUMN "jlawyerId" TEXT;

-- AlterTable
ALTER TABLE "dokumente" ADD COLUMN "jlawyerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "akten_jlawyerId_key" ON "akten"("jlawyerId");

-- CreateIndex
CREATE UNIQUE INDEX "kontakte_jlawyerId_key" ON "kontakte"("jlawyerId");

-- CreateIndex
CREATE INDEX "kalender_eintraege_jlawyerId_idx" ON "kalender_eintraege"("jlawyerId");

-- CreateIndex
CREATE INDEX "dokumente_jlawyerId_idx" ON "dokumente"("jlawyerId");
