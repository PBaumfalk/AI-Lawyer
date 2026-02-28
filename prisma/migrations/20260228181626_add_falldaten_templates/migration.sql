-- CreateEnum
CREATE TYPE "FalldatenTemplateStatus" AS ENUM ('ENTWURF', 'EINGEREICHT', 'GENEHMIGT', 'ABGELEHNT', 'STANDARD');

-- CreateTable
CREATE TABLE "falldaten_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "sachgebiet" "Sachgebiet",
    "schema" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "FalldatenTemplateStatus" NOT NULL DEFAULT 'ENTWURF',
    "erstelltVonId" TEXT NOT NULL,
    "geprueftVonId" TEXT,
    "geprueftAt" TIMESTAMP(3),
    "ablehnungsgrund" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "falldaten_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "akten" ADD COLUMN "falldatenTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "falldaten_templates_status_idx" ON "falldaten_templates"("status");

-- CreateIndex
CREATE INDEX "falldaten_templates_sachgebiet_idx" ON "falldaten_templates"("sachgebiet");

-- CreateIndex
CREATE INDEX "falldaten_templates_erstelltVonId_idx" ON "falldaten_templates"("erstelltVonId");

-- AddForeignKey
ALTER TABLE "akten" ADD CONSTRAINT "akten_falldatenTemplateId_fkey" FOREIGN KEY ("falldatenTemplateId") REFERENCES "falldaten_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "falldaten_templates" ADD CONSTRAINT "falldaten_templates_erstelltVonId_fkey" FOREIGN KEY ("erstelltVonId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "falldaten_templates" ADD CONSTRAINT "falldaten_templates_geprueftVonId_fkey" FOREIGN KEY ("geprueftVonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
