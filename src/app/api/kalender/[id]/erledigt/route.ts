import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const erledigtSchema = z.object({
  erledigt: z.boolean(),
  erledigungsgrund: z.string().optional(),
  ueberschreitungsgrund: z.string().optional(),
});

/**
 * PATCH /api/kalender/[id]/erledigt -- toggle erledigt status
 *
 * For FRIST entries being marked as erledigt, erledigungsgrund is mandatory.
 * For overdue FRIST entries, an additional ueberschreitungsgrund is required.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = erledigtSchema.safeParse(body);

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

  // For FRIST entries being marked as erledigt, erledigungsgrund is mandatory
  if (
    parsed.data.erledigt &&
    existing.typ === "FRIST" &&
    (!parsed.data.erledigungsgrund || !parsed.data.erledigungsgrund.trim())
  ) {
    return NextResponse.json(
      { error: "Fuer Fristen ist ein Erledigungsgrund zwingend erforderlich" },
      { status: 400 }
    );
  }

  // Check if overdue (past datum) for FRIST entries
  const now = new Date();
  const isOverdue = existing.datum < now && existing.typ === "FRIST";
  if (parsed.data.erledigt && isOverdue && !parsed.data.ueberschreitungsgrund) {
    return NextResponse.json(
      { error: "Fuer ueberfaellige Fristen ist ein Ueberschreitungsgrund erforderlich" },
      { status: 400 }
    );
  }

  const eintrag = await prisma.kalenderEintrag.update({
    where: { id },
    data: {
      erledigt: parsed.data.erledigt,
      erledigtAm: parsed.data.erledigt ? now : null,
      erledigungsgrund: parsed.data.erledigt
        ? (parsed.data.erledigungsgrund?.trim() ?? null)
        : null,
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
    },
  });

  const userId = session.user.id;

  await logAuditEvent({
    userId,
    akteId: eintrag.akteId ?? undefined,
    aktion: parsed.data.erledigt ? "FRIST_ERLEDIGT" : "KALENDER_BEARBEITET",
    details: {
      kalenderId: eintrag.id,
      titel: eintrag.titel,
      typ: eintrag.typ,
      erledigt: parsed.data.erledigt,
      erledigungsgrund: parsed.data.erledigungsgrund ?? null,
      ueberschreitungsgrund: parsed.data.ueberschreitungsgrund ?? null,
      istUeberfaellig: isOverdue,
    },
  });

  return NextResponse.json(eintrag);
}
