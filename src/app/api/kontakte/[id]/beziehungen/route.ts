import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const beziehungSchema = z.object({
  zuKontaktId: z.string().min(1, "Ziel-Kontakt ist erforderlich"),
  typ: z.enum([
    "EHEPARTNER", "KIND", "ELTERNTEIL", "GESETZLICHER_VERTRETER",
    "BETREUER", "ARBEITGEBER", "ARBEITNEHMER",
    "GESCHAEFTSFUEHRER", "GESELLSCHAFTER", "SONSTIGE",
  ]),
  beschreibung: z.string().nullable().optional(),
});

// GET /api/kontakte/[id]/beziehungen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const [von, zu] = await Promise.all([
    prisma.kontaktBeziehung.findMany({
      where: { vonKontaktId: id },
      include: { zuKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.kontaktBeziehung.findMany({
      where: { zuKontaktId: id },
      include: { vonKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ von, zu });
}

// POST /api/kontakte/[id]/beziehungen
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
  const parsed = beziehungSchema.safeParse(body);

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

  if (parsed.data.zuKontaktId === id) {
    return NextResponse.json({ error: "Beziehung zu sich selbst nicht möglich" }, { status: 400 });
  }

  const zuKontakt = await prisma.kontakt.findUnique({ where: { id: parsed.data.zuKontaktId } });
  if (!zuKontakt) {
    return NextResponse.json({ error: "Ziel-Kontakt nicht gefunden" }, { status: 404 });
  }

  const beziehung = await prisma.kontaktBeziehung.create({
    data: { vonKontaktId: id, ...parsed.data },
    include: {
      zuKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } },
    },
  });

  return NextResponse.json(beziehung, { status: 201 });
}
