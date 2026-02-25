import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { z } from "zod";

const createKalenderSchema = z.object({
  typ: z.enum(["TERMIN", "FRIST", "WIEDERVORLAGE"]),
  titel: z.string().min(1, "Titel ist erforderlich"),
  beschreibung: z.string().nullable().optional(),
  datum: z.string().datetime({ message: "Ungueltiges Datumsformat" }),
  datumBis: z.string().datetime().nullable().optional(),
  ganztaegig: z.boolean().optional(),
  akteId: z.string().nullable().optional(),
  verantwortlichId: z.string().min(1, "Verantwortlicher ist erforderlich"),
  fristablauf: z.string().datetime().nullable().optional(),
  vorfrist: z.string().datetime().nullable().optional(),
  // Enhanced Frist fields
  prioritaet: z
    .enum(["SEHR_NIEDRIG", "NIEDRIG", "NORMAL", "HOCH", "DRINGEND"])
    .optional()
    .default("NORMAL"),
  fristArt: z.enum(["EREIGNISFRIST", "BEGINNFRIST"]).nullable().optional(),
  bundesland: z.string().nullable().optional(),
  istNotfrist: z.boolean().optional().default(false),
  vorfristen: z.array(z.string().datetime()).optional(),
  halbfrist: z.string().datetime().nullable().optional(),
  sachbearbeiterId: z.string().nullable().optional(),
  dokumentIds: z.array(z.string()).optional(),
  sonderfall: z
    .enum(["OEFFENTLICHE_ZUSTELLUNG", "AUSLANDSZUSTELLUNG_EU"])
    .nullable()
    .optional(),
  hauptfristId: z.string().nullable().optional(),
});

// GET /api/kalender -- list calendar entries filtered by Akte access
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const typ = searchParams.get("typ");
  const erledigt = searchParams.get("erledigt");
  const akteId = searchParams.get("akteId");
  const verantwortlichId = searchParams.get("verantwortlichId");
  const prioritaet = searchParams.get("prioritaet");
  const istNotfrist = searchParams.get("istNotfrist");

  const where: any = {};

  // RBAC: filter calendar entries by accessible Akten
  const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
  if (Object.keys(accessFilter).length > 0) {
    // Non-admin: only see entries linked to accessible Akten, or entries with no Akte
    where.OR = [
      { akteId: null }, // Personal entries without Akte
      { akte: accessFilter },
    ];
  }

  // Date range filter
  if (von || bis) {
    where.datum = {};
    if (von) where.datum.gte = new Date(von);
    if (bis) where.datum.lte = new Date(bis);
  }

  // Type filter
  if (typ && ["TERMIN", "FRIST", "WIEDERVORLAGE"].includes(typ)) {
    where.typ = typ;
  }

  // Erledigt filter
  if (erledigt === "true") {
    where.erledigt = true;
  } else if (erledigt === "false") {
    where.erledigt = false;
  }

  // Case filter
  if (akteId) {
    where.akteId = akteId;
  }

  // Responsible user filter
  if (verantwortlichId) {
    where.verantwortlichId = verantwortlichId;
  }

  // Priority filter
  if (
    prioritaet &&
    ["SEHR_NIEDRIG", "NIEDRIG", "NORMAL", "HOCH", "DRINGEND"].includes(prioritaet)
  ) {
    where.prioritaet = prioritaet;
  }

  // Notfrist filter
  if (istNotfrist === "true") {
    where.istNotfrist = true;
  }

  const eintraege = await prisma.kalenderEintrag.findMany({
    where,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
      sachbearbeiter: { select: { id: true, name: true } },
      hauptfrist: { select: { id: true, titel: true, datum: true } },
      _count: { select: { vorfristEintraege: true } },
    },
    orderBy: { datum: "asc" },
  });

  return NextResponse.json(eintraege);
}

// POST /api/kalender -- create new calendar entry with enhanced fields
export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const body = await request.json();
  const parsed = createKalenderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Create the main entry
  const eintrag = await prisma.kalenderEintrag.create({
    data: {
      typ: parsed.data.typ,
      titel: parsed.data.titel,
      beschreibung: parsed.data.beschreibung ?? null,
      datum: new Date(parsed.data.datum),
      datumBis: parsed.data.datumBis ? new Date(parsed.data.datumBis) : null,
      ganztaegig: parsed.data.ganztaegig ?? false,
      akteId: parsed.data.akteId ?? null,
      verantwortlichId: parsed.data.verantwortlichId,
      fristablauf: parsed.data.fristablauf ? new Date(parsed.data.fristablauf) : null,
      vorfrist: parsed.data.vorfrist ? new Date(parsed.data.vorfrist) : null,
      // Enhanced fields
      prioritaet: parsed.data.prioritaet,
      fristArt: parsed.data.fristArt ?? null,
      bundesland: parsed.data.bundesland ?? null,
      istNotfrist: parsed.data.istNotfrist,
      vorfristen: parsed.data.vorfristen
        ? parsed.data.vorfristen.map((d) => new Date(d))
        : [],
      halbfrist: parsed.data.halbfrist ? new Date(parsed.data.halbfrist) : null,
      sachbearbeiterId: parsed.data.sachbearbeiterId ?? null,
      dokumentIds: parsed.data.dokumentIds ?? [],
      sonderfall: parsed.data.sonderfall ?? null,
      hauptfristId: parsed.data.hauptfristId ?? null,
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
    },
  });

  // If FRIST type with vorfristen dates, create child KalenderEintrag records for each Vorfrist
  if (
    parsed.data.typ === "FRIST" &&
    parsed.data.vorfristen &&
    parsed.data.vorfristen.length > 0
  ) {
    const vorfristEntries = parsed.data.vorfristen.map((vfDatum, idx) => ({
      typ: "FRIST" as const,
      titel: `Vorfrist ${idx + 1}: ${parsed.data.titel}`,
      datum: new Date(vfDatum),
      ganztaegig: true,
      verantwortlichId: parsed.data.verantwortlichId,
      akteId: parsed.data.akteId ?? null,
      hauptfristId: eintrag.id,
      prioritaet: parsed.data.prioritaet,
      istNotfrist: parsed.data.istNotfrist,
    }));

    await prisma.kalenderEintrag.createMany({ data: vorfristEntries });
  }

  // Determine audit action based on entry type
  const aktionMap: Record<string, string> = {
    TERMIN: "TERMIN_ERSTELLT",
    FRIST: "FRIST_ERSTELLT",
    WIEDERVORLAGE: "WIEDERVORLAGE_ERSTELLT",
  };

  await logAuditEvent({
    userId,
    akteId: eintrag.akteId ?? undefined,
    aktion: aktionMap[eintrag.typ] as any,
    details: {
      kalenderId: eintrag.id,
      titel: eintrag.titel,
      typ: eintrag.typ,
      datum: eintrag.datum.toISOString(),
      prioritaet: eintrag.prioritaet,
      istNotfrist: eintrag.istNotfrist,
      sonderfall: eintrag.sonderfall,
    },
  });

  return NextResponse.json(eintrag, { status: 201 });
}
