import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent, computeChanges } from "@/lib/audit";
import { requireAkteAccess, requirePermission } from "@/lib/rbac";
import { z } from "zod";

const updateAkteSchema = z.object({
  kurzrubrum: z.string().min(1).optional(),
  wegen: z.string().optional(),
  sachgebiet: z.enum([
    "ARBEITSRECHT", "FAMILIENRECHT", "VERKEHRSRECHT", "MIETRECHT",
    "STRAFRECHT", "ERBRECHT", "SOZIALRECHT", "INKASSO",
    "HANDELSRECHT", "VERWALTUNGSRECHT", "SONSTIGES",
  ]).optional(),
  status: z.enum(["OFFEN", "RUHEND", "ARCHIVIERT", "GESCHLOSSEN"]).optional(),
  gegenstandswert: z.number().positive().nullable().optional(),
  anwaltId: z.string().nullable().optional(),
  sachbearbeiterId: z.string().nullable().optional(),
  notizen: z.string().nullable().optional(),
  falldaten: z.record(z.any()).nullable().optional(),
});

// GET /api/akten/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // RBAC: check Akte access (returns 404 if unauthorized)
  const access = await requireAkteAccess(id);
  if (access.error) return access.error;

  const akte = await prisma.akte.findUnique({
    where: { id },
    include: {
      anwalt: { select: { id: true, name: true, email: true } },
      sachbearbeiter: { select: { id: true, name: true, email: true } },
      kanzlei: { select: { name: true } },
      beteiligte: {
        include: {
          kontakt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      dokumente: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
      kalenderEintraege: {
        orderBy: { datum: "asc" },
        include: { verantwortlich: { select: { name: true } } },
      },
      _count: {
        select: {
          dokumente: true,
          kalenderEintraege: true,
          zeiterfassungen: true,
          rechnungen: true,
          chatNachrichten: true,
        },
      },
    },
  });

  if (!akte) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(akte);
}

// PATCH /api/akten/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // RBAC: check Akte access with edit permission
  const access = await requireAkteAccess(id, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const body = await request.json();
  const parsed = updateAkteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.akte.findUnique({
    where: { id },
    include: {
      anwalt: { select: { id: true, name: true } },
      sachbearbeiter: { select: { id: true, name: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  if (parsed.data.status === "ARCHIVIERT" && existing.status !== "ARCHIVIERT") {
    data.archiviert = new Date();
  }

  const akte = await prisma.akte.update({
    where: { id },
    data,
    include: {
      anwalt: { select: { id: true, name: true } },
      sachbearbeiter: { select: { id: true, name: true } },
    },
  });

  const userId = session.user.id;

  // Resolve user names for anwalt/sachbearbeiter changes
  const oldValues: Record<string, any> = { ...existing };
  const newValues: Record<string, any> = { ...parsed.data };

  // Replace IDs with names for readable diffs
  if (newValues.anwaltId !== undefined) {
    oldValues.anwaltId = existing.anwalt?.name ?? null;
    newValues.anwaltId = akte.anwalt?.name ?? null;
  }
  if (newValues.sachbearbeiterId !== undefined) {
    oldValues.sachbearbeiterId = existing.sachbearbeiter?.name ?? null;
    newValues.sachbearbeiterId = akte.sachbearbeiter?.name ?? null;
  }

  // Log status change as separate event
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await logAuditEvent({
      userId,
      akteId: id,
      aktion: "STATUS_GEAENDERT",
      details: {
        alt: existing.status,
        neu: parsed.data.status,
      },
    });
  }

  // Log notizen change as separate event
  if (parsed.data.notizen !== undefined && parsed.data.notizen !== existing.notizen) {
    await logAuditEvent({
      userId,
      akteId: id,
      aktion: "NOTIZ_GEAENDERT",
      details: {
        vorher: existing.notizen
          ? (existing.notizen.length > 80 ? existing.notizen.substring(0, 80) + "..." : existing.notizen)
          : null,
        nachher: parsed.data.notizen
          ? (parsed.data.notizen.length > 80 ? parsed.data.notizen.substring(0, 80) + "..." : parsed.data.notizen)
          : null,
      },
    });
  }

  // Log falldaten change
  if (parsed.data.falldaten !== undefined) {
    await logAuditEvent({
      userId,
      akteId: id,
      aktion: "AKTE_BEARBEITET",
      details: { aenderungen: [{ feld: "Falldaten", feldKey: "falldaten", alt: "---", neu: "aktualisiert" }] },
    });
  }

  // Log general field changes (excluding status/notizen/falldaten which are logged separately)
  const { status: _s, notizen: _n, falldaten: _f, ...otherChanges } = parsed.data;
  const filteredNew = Object.fromEntries(
    Object.entries(otherChanges).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(filteredNew).length > 0) {
    const changes = computeChanges(oldValues, filteredNew);
    if (changes.length > 0) {
      await logAuditEvent({
        userId,
        akteId: id,
        aktion: "AKTE_BEARBEITET",
        details: { aenderungen: changes },
      });
    }
  }

  // Check for Keine Akte ohne Frist/WV warning
  const activeFristenWv = await prisma.kalenderEintrag.count({
    where: {
      akteId: id,
      erledigt: false,
      typ: { in: ["FRIST", "WIEDERVORLAGE"] },
    },
  });

  const warning =
    activeFristenWv === 0
      ? "Diese Akte hat weder eine laufende Frist noch eine Wiedervorlage."
      : undefined;

  return NextResponse.json({ ...akte, warning });
}
