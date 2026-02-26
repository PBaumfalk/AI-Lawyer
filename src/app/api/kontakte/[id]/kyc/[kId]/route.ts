import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateKycSchema = z.object({
  dokumentart: z.enum(["PERSONALAUSWEIS", "REISEPASS", "FUEHRERSCHEIN", "AUFENTHALTSTITEL", "SONSTIGE"]).optional(),
  ausweisnummer: z.string().nullable().optional(),
  behoerde: z.string().nullable().optional(),
  datum: z.string().nullable().optional(),
  gueltigBis: z.string().nullable().optional(),
  pruefmethode: z.string().nullable().optional(),
  status: z.enum(["NICHT_GEPRUEFT", "IN_PRUEFUNG", "VERIFIZIERT", "ABGELEHNT", "ABGELAUFEN"]).optional(),
  risikoEinstufung: z.enum(["NIEDRIG", "MITTEL", "HOCH"]).nullable().optional(),
  notizen: z.string().nullable().optional(),
});

// PATCH /api/kontakte/[id]/kyc/[kId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; kId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, kId } = await params;
  const body = await request.json();
  const parsed = updateKycSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pruefung = await prisma.identitaetsPruefung.findFirst({
    where: { id: kId, kontaktId: id },
  });
  if (!pruefung) {
    return NextResponse.json({ error: "Prüfung nicht gefunden" }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  if (data.datum && typeof data.datum === "string") data.datum = new Date(data.datum);
  if (data.gueltigBis && typeof data.gueltigBis === "string") data.gueltigBis = new Date(data.gueltigBis);

  const updated = await prisma.identitaetsPruefung.update({
    where: { id: kId },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/kontakte/[id]/kyc/[kId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; kId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, kId } = await params;
  const pruefung = await prisma.identitaetsPruefung.findFirst({
    where: { id: kId, kontaktId: id },
  });
  if (!pruefung) {
    return NextResponse.json({ error: "Prüfung nicht gefunden" }, { status: 404 });
  }

  await prisma.identitaetsPruefung.delete({ where: { id: kId } });
  return NextResponse.json({ success: true });
}
