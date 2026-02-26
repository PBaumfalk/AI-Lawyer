import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const vollmachtSchema = z.object({
  nehmerId: z.string().min(1, "Vollmachtnehmer ist erforderlich"),
  typ: z.enum(["EINZELVOLLMACHT", "GENERALVOLLMACHT", "PROZESSVOLLMACHT", "VORSORGEVOLLMACHT", "SONSTIGE"]),
  umfang: z.string().nullable().optional(),
  erteilungsdatum: z.string().nullable().optional(),
  beginn: z.string().nullable().optional(),
  ende: z.string().nullable().optional(),
  beschraenkungen: z.string().nullable().optional(),
});

// GET /api/kontakte/[id]/vollmachten
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const vollmachten = await prisma.vollmacht.findMany({
    where: { geberId: id },
    include: {
      nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(vollmachten);
}

// POST /api/kontakte/[id]/vollmachten
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
  const parsed = vollmachtSchema.safeParse(body);

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

  const nehmer = await prisma.kontakt.findUnique({ where: { id: parsed.data.nehmerId } });
  if (!nehmer) {
    return NextResponse.json({ error: "Vollmachtnehmer nicht gefunden" }, { status: 404 });
  }

  const data: any = { geberId: id, ...parsed.data };
  for (const dateField of ["erteilungsdatum", "beginn", "ende"]) {
    if (data[dateField] && typeof data[dateField] === "string") {
      data[dateField] = new Date(data[dateField]);
    }
  }

  const vollmacht = await prisma.vollmacht.create({
    data,
    include: {
      nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } },
    },
  });

  return NextResponse.json(vollmacht, { status: 201 });
}
