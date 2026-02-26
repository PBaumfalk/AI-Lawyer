import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const kycSchema = z.object({
  dokumentart: z.enum(["PERSONALAUSWEIS", "REISEPASS", "FUEHRERSCHEIN", "AUFENTHALTSTITEL", "SONSTIGE"]),
  ausweisnummer: z.string().nullable().optional(),
  behoerde: z.string().nullable().optional(),
  datum: z.string().nullable().optional(),
  gueltigBis: z.string().nullable().optional(),
  pruefmethode: z.string().nullable().optional(),
  status: z.enum(["NICHT_GEPRUEFT", "IN_PRUEFUNG", "VERIFIZIERT", "ABGELEHNT", "ABGELAUFEN"]).default("NICHT_GEPRUEFT"),
  risikoEinstufung: z.enum(["NIEDRIG", "MITTEL", "HOCH"]).nullable().optional(),
  notizen: z.string().nullable().optional(),
});

// GET /api/kontakte/[id]/kyc
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const pruefungen = await prisma.identitaetsPruefung.findMany({
    where: { kontaktId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pruefungen);
}

// POST /api/kontakte/[id]/kyc
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
  const parsed = kycSchema.safeParse(body);

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

  const data: any = { kontaktId: id, ...parsed.data };
  if (data.datum) data.datum = new Date(data.datum);
  if (data.gueltigBis) data.gueltigBis = new Date(data.gueltigBis);

  const pruefung = await prisma.identitaetsPruefung.create({ data });
  return NextResponse.json(pruefung, { status: 201 });
}
