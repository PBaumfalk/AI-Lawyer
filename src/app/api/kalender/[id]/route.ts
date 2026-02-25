import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import { z } from "zod";

const updateKalenderSchema = z.object({
  typ: z.enum(["TERMIN", "FRIST", "WIEDERVORLAGE"]).optional(),
  titel: z.string().min(1, "Titel ist erforderlich").optional(),
  beschreibung: z.string().nullable().optional(),
  datum: z.string().datetime().optional(),
  datumBis: z.string().datetime().nullable().optional(),
  ganztaegig: z.boolean().optional(),
  erledigt: z.boolean().optional(),
  akteId: z.string().nullable().optional(),
  verantwortlichId: z.string().optional(),
  fristablauf: z.string().datetime().nullable().optional(),
  vorfrist: z.string().datetime().nullable().optional(),
});

// GET /api/kalender/[id] -- get single calendar entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { id } = await params;

  const eintrag = await prisma.kalenderEintrag.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
    },
  });

  if (!eintrag) {
    return NextResponse.json({ error: "Kalendereintrag nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to linked Akte if present
  if (eintrag.akteId) {
    const access = await requireAkteAccess(eintrag.akteId);
    if (access.error) return access.error;
  }

  return NextResponse.json(eintrag);
}

// PATCH /api/kalender/[id] -- update calendar entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateKalenderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.kalenderEintrag.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kalendereintrag nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to linked Akte if present
  if (existing.akteId) {
    const access = await requireAkteAccess(existing.akteId, { requireEdit: true });
    if (access.error) return access.error;
  }

  // Build update data, converting ISO strings to Date objects
  const data: any = {};
  if (parsed.data.typ !== undefined) data.typ = parsed.data.typ;
  if (parsed.data.titel !== undefined) data.titel = parsed.data.titel;
  if (parsed.data.beschreibung !== undefined) data.beschreibung = parsed.data.beschreibung;
  if (parsed.data.datum !== undefined) data.datum = new Date(parsed.data.datum);
  if (parsed.data.datumBis !== undefined) data.datumBis = parsed.data.datumBis ? new Date(parsed.data.datumBis) : null;
  if (parsed.data.ganztaegig !== undefined) data.ganztaegig = parsed.data.ganztaegig;
  if (parsed.data.akteId !== undefined) data.akteId = parsed.data.akteId;
  if (parsed.data.verantwortlichId !== undefined) data.verantwortlichId = parsed.data.verantwortlichId;
  if (parsed.data.fristablauf !== undefined) data.fristablauf = parsed.data.fristablauf ? new Date(parsed.data.fristablauf) : null;
  if (parsed.data.vorfrist !== undefined) data.vorfrist = parsed.data.vorfrist ? new Date(parsed.data.vorfrist) : null;

  // Handle erledigt state change
  if (parsed.data.erledigt !== undefined) {
    data.erledigt = parsed.data.erledigt;
    if (parsed.data.erledigt && !existing.erledigt) {
      data.erledigtAm = new Date();
    } else if (!parsed.data.erledigt) {
      data.erledigtAm = null;
    }
  }

  const eintrag = await prisma.kalenderEintrag.update({
    where: { id },
    data,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
    },
  });

  const userId = session.user.id;

  // Log specific audit event for erledigt changes
  if (parsed.data.erledigt !== undefined && parsed.data.erledigt !== existing.erledigt) {
    if (parsed.data.erledigt) {
      await logAuditEvent({
        userId,
        akteId: eintrag.akteId ?? undefined,
        aktion: "FRIST_ERLEDIGT",
        details: {
          kalenderId: eintrag.id,
          titel: eintrag.titel,
          typ: eintrag.typ,
        },
      });
    }
  }

  // Log general update
  await logAuditEvent({
    userId,
    akteId: eintrag.akteId ?? undefined,
    aktion: "KALENDER_BEARBEITET",
    details: {
      kalenderId: eintrag.id,
      titel: eintrag.titel,
      typ: eintrag.typ,
      geaenderteFelder: Object.keys(parsed.data),
    },
  });

  return NextResponse.json(eintrag);
}

// DELETE /api/kalender/[id] -- delete calendar entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;

  const existing = await prisma.kalenderEintrag.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kalendereintrag nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to linked Akte if present
  if (existing.akteId) {
    const access = await requireAkteAccess(existing.akteId, { requireEdit: true });
    if (access.error) return access.error;
  }

  await prisma.kalenderEintrag.delete({ where: { id } });

  const userId = session.user.id;

  await logAuditEvent({
    userId,
    akteId: existing.akteId ?? undefined,
    aktion: "KALENDER_GELOESCHT",
    details: {
      kalenderId: existing.id,
      titel: existing.titel,
      typ: existing.typ,
      datum: existing.datum.toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}
