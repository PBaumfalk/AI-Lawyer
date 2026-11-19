-- Helena Datei-Pipeline: Mandant consent to AI processing (§ 43e Abs. 5 BRAO)
CREATE TYPE "KiEinwilligung" AS ENUM ('KEINE', 'DE_MODELLE', 'FREMDMODELLE');

ALTER TABLE "akten"
  ADD COLUMN "kiEinwilligung" "KiEinwilligung" NOT NULL DEFAULT 'KEINE',
  ADD COLUMN "kiEinwilligungAm" TIMESTAMP(3),
  ADD COLUMN "kiEinwilligungErfasstVon" TEXT;
