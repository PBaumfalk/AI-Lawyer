import { NextRequest, NextResponse } from "next/server";
import { akteAccessDenied } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { enqueueQuestCheck } from "@/lib/gamification/quest-service";
import { gamificationQueue } from "@/lib/queue/queues";
import {
  erledigtRequestSchema,
  istFristUeberfaellig,
  pruefeErledigung,
} from "@/lib/fristen/erledigung";

/**
 * PATCH /api/kalender/[id]/erledigt -- toggle erledigt status
 *
 * For FRIST entries being marked as erledigt, erledigungsgrund is mandatory.
 * For overdue FRIST entries (last day fully elapsed, Europe/Berlin), an
 * additional ueberschreitungsgrund is required. Rules: src/lib/fristen/erledigung.ts
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
  const body = await request.json().catch(() => null);
  const parsed = erledigtRequestSchema.safeParse(body);

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
  if (existing.akteId) {
    const denied = await akteAccessDenied(session, existing.akteId);
    if (denied) return denied;
  }

  const now = new Date();
  const fehler = pruefeErledigung(existing, parsed.data, now);
  if (fehler) {
    return NextResponse.json({ error: fehler }, { status: 400 });
  }
  const isOverdue = existing.typ === "FRIST" && istFristUeberfaellig(existing.datum, now);

  const eintrag = await prisma.kalenderEintrag.update({
    where: { id },
    data: {
      erledigt: parsed.data.erledigt,
      erledigtAm: parsed.data.erledigt ? now : null,
      erledigungsgrund: parsed.data.erledigt
        ? (parsed.data.erledigungsgrund?.trim() || null)
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
      erledigungsgrund: parsed.data.erledigungsgrund?.trim() || null,
      ueberschreitungsgrund: parsed.data.ueberschreitungsgrund?.trim() || null,
      istUeberfaellig: isOverdue,
    },
  });

  // Gamification: enqueue quest check when Frist/WV marked as erledigt
  if (parsed.data.erledigt && userId) {
    enqueueQuestCheck(userId);
  }

  // Bossfight: enqueue boss damage when Wiedervorlage marked as erledigt
  if (parsed.data.erledigt && existing.typ === "WIEDERVORLAGE") {
    const damageUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { kanzleiId: true, name: true },
    });
    if (damageUser?.kanzleiId) {
      gamificationQueue
        .add("boss-damage", {
          userId,
          kanzleiId: damageUser.kanzleiId,
          userName: damageUser.name ?? undefined,
        })
        .catch(() => {}); // fire-and-forget
    }
  }

  return NextResponse.json(eintrag);
}
