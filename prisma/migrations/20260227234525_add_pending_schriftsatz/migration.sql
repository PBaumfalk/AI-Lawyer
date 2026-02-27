-- CreateTable
CREATE TABLE "pending_schriftsaetze" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "akteId" TEXT NOT NULL,
    "intentState" JSONB NOT NULL,
    "slotState" JSONB NOT NULL,
    "rueckfrage" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_schriftsaetze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_schriftsaetze_userId_idx" ON "pending_schriftsaetze"("userId");

-- CreateIndex
CREATE INDEX "pending_schriftsaetze_expiresAt_idx" ON "pending_schriftsaetze"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_schriftsaetze_userId_akteId_key" ON "pending_schriftsaetze"("userId", "akteId");

-- AddForeignKey
ALTER TABLE "pending_schriftsaetze" ADD CONSTRAINT "pending_schriftsaetze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_schriftsaetze" ADD CONSTRAINT "pending_schriftsaetze_akteId_fkey" FOREIGN KEY ("akteId") REFERENCES "akten"("id") ON DELETE CASCADE ON UPDATE CASCADE;
