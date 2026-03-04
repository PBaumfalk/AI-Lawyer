/**
 * GET/POST /api/gamification/special-quests
 *
 * Admin-only endpoints for managing Special Quests.
 * GET: Returns all SPECIAL quests (ordered by createdAt desc) + condition templates.
 * POST: Creates a new SPECIAL quest from a condition template.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { CONDITION_TEMPLATES } from "@/lib/gamification/condition-templates";

// ─── GET: List all SPECIAL quests + templates ───────────────────────────────

export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const quests = await prisma.quest.findMany({
    where: { typ: "SPECIAL" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quests, templates: CONDITION_TEMPLATES });
}

// ─── POST: Create a new SPECIAL quest ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body = await request.json();
  const {
    name,
    beschreibung,
    templateId,
    count,
    xpBelohnung,
    runenBelohnung,
    startDatum,
    endDatum,
    targetKlasse,
  } = body;

  if (!name || !templateId || !count || !startDatum || !endDatum) {
    return NextResponse.json(
      { error: "Pflichtfelder fehlen" },
      { status: 400 },
    );
  }

  const template = CONDITION_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json(
      { error: "Unbekannte Vorlage" },
      { status: 400 },
    );
  }

  const quest = await prisma.quest.create({
    data: {
      name,
      beschreibung: beschreibung || null,
      typ: "SPECIAL",
      klasse:
        targetKlasse === "ALL" || !targetKlasse ? null : targetKlasse,
      bedingung: {
        ...template.condition,
        type: "count",
        count: Number(count),
      },
      xpBelohnung: Number(xpBelohnung) || 50,
      runenBelohnung: Number(runenBelohnung) || 10,
      startDatum: new Date(startDatum),
      endDatum: new Date(endDatum),
      aktiv: true,
      sortierung: 0,
    },
  });

  return NextResponse.json(quest, { status: 201 });
}
