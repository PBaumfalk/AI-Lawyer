import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const adresseSchema = z.object({
  typ: z.enum(["HAUPTANSCHRIFT", "ZUSTELLANSCHRIFT", "RECHNUNGSANSCHRIFT", "SONSTIGE"]).default("HAUPTANSCHRIFT"),
  bezeichnung: z.string().nullable().optional(),
  strasse: z.string().nullable().optional(),
  hausnummer: z.string().nullable().optional(),
  plz: z.string().nullable().optional(),
  ort: z.string().nullable().optional(),
  land: z.string().nullable().optional(),
  istHaupt: z.boolean().optional(),
});

// GET /api/kontakte/[id]/adressen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const adressen = await prisma.adresse.findMany({
    where: { kontaktId: id },
    orderBy: [{ istHaupt: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(adressen);
}

// POST /api/kontakte/[id]/adressen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = adresseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const kontakt = await prisma.kontakt.findUnique({ where: { id } });
  if (!kontakt) {
    return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  }

  // If this is set as main, unset other main addresses
  if (parsed.data.istHaupt) {
    await prisma.adresse.updateMany({
      where: { kontaktId: id, istHaupt: true },
      data: { istHaupt: false },
    });
  }

  const adresse = await prisma.adresse.create({
    data: { kontaktId: id, ...parsed.data },
  });

  return NextResponse.json(adresse, { status: 201 });
}
