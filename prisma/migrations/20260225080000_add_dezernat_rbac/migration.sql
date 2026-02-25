-- CreateTable
CREATE TABLE "dezernate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "kanzleiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dezernate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_overrides" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "grund" TEXT NOT NULL,
    "gueltigBis" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable (join table for Dezernat <-> User many-to-many)
CREATE TABLE "_DezernatMitglieder" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DezernatMitglieder_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable (join table for Dezernat <-> Akte many-to-many)
CREATE TABLE "_DezernatAkten" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DezernatAkten_AB_pkey" PRIMARY KEY ("A","B")
);

-- AlterTable (add DSGVO anonymization fields to Kontakt)
ALTER TABLE "kontakte" ADD COLUMN "anonymisiertAm" TIMESTAMP(3);
ALTER TABLE "kontakte" ADD COLUMN "anonymisiertVon" TEXT;

-- CreateIndex
CREATE INDEX "_DezernatMitglieder_B_index" ON "_DezernatMitglieder"("B");

-- CreateIndex
CREATE INDEX "_DezernatAkten_B_index" ON "_DezernatAkten"("B");

-- CreateIndex
CREATE UNIQUE INDEX "admin_overrides_adminId_akteId_key" ON "admin_overrides"("adminId", "akteId");

-- CreateIndex
CREATE INDEX "admin_overrides_akteId_idx" ON "admin_overrides"("akteId");

-- AddForeignKey
ALTER TABLE "dezernate" ADD CONSTRAINT "dezernate_kanzleiId_fkey" FOREIGN KEY ("kanzleiId") REFERENCES "kanzleien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_overrides" ADD CONSTRAINT "admin_overrides_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_overrides" ADD CONSTRAINT "admin_overrides_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatMitglieder" ADD CONSTRAINT "_DezernatMitglieder_A_fkey" FOREIGN KEY ("A") REFERENCES "dezernate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatMitglieder" ADD CONSTRAINT "_DezernatMitglieder_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatAkten" ADD CONSTRAINT "_DezernatAkten_A_fkey" FOREIGN KEY ("A") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DezernatAkten" ADD CONSTRAINT "_DezernatAkten_B_fkey" FOREIGN KEY ("B") REFERENCES "dezernate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
