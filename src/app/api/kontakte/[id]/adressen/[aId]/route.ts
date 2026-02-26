import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateAdresseSchema = z.object({
  typ: z.enum(["HAUPTANSCHRIFT", "ZUSTELLANSCHRIFT", "RECHNUNGSANSCHRIFT", "SONSTIGE"]).optional(),
  bezeichnung: z.string().nullable().optional(),
  strasse: z.string().nullable().optional(),
  hausnummer: z.string().nullable().optional(),
  plz: z.string().nullable().optional(),
  ort: z.string().nullable().optional(),
  land: z.string().nullable().optional(),
  istHaupt: z.boolean().optional(),
});

// PATCH /api/kontakte/[id]/adressen/[aId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; aId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, aId } = await params;
  const body = await request.json();
  const parsed = updateAdresseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adresse = await prisma.adresse.findFirst({
    where: { id: aId, kontaktId: id },
  });
  if (!adresse) {
    return NextResponse.json({ error: "Adresse nicht gefunden" }, { status: 404 });
  }

  if (parsed.data.istHaupt) {
    await prisma.adresse.updateMany({
      where: { kontaktId: id, istHaupt: true, NOT: { id: aId } },
      data: { istHaupt: false },
    });
  }

  const updated = await prisma.adresse.update({
    where: { id: aId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/kontakte/[id]/adressen/[aId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; aId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id, aId } = await params;
  const adresse = await prisma.adresse.findFirst({
    where: { id: aId, kontaktId: id },
  });
  if (!adresse) {
    return NextResponse.json({ error: "Adresse nicht gefunden" }, { status: 404 });
  }

  await prisma.adresse.delete({ where: { id: aId } });
  return NextResponse.json({ success: true });
}
