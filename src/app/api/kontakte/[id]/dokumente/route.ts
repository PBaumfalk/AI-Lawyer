import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const dokumentSchema = z.object({
  kategorie: z.enum(["IDENTITAET", "VERTRAG", "VOLLMACHT", "KYC", "HR_AUSZUG", "SONSTIGE"]).default("SONSTIGE"),
  name: z.string().min(1, "Name ist erforderlich"),
  dateipfad: z.string().min(1, "Dateipfad ist erforderlich"),
  mimeType: z.string().min(1),
  groesse: z.number().int().positive(),
});

// GET /api/kontakte/[id]/dokumente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const dokumente = await prisma.kontaktDokument.findMany({
    where: { kontaktId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(dokumente);
}

// POST /api/kontakte/[id]/dokumente
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
  const parsed = dokumentSchema.safeParse(body);

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

  const dokument = await prisma.kontaktDokument.create({
    data: { kontaktId: id, ...parsed.data },
  });

  return NextResponse.json(dokument, { status: 201 });
}
