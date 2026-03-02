/**
 * PATCH/DELETE /api/gamification/special-quests/[id]
 *
 * Admin-only endpoints for updating and deleting individual Special Quests.
 * PATCH: Update allowed fields (name, dates, rewards, etc).
 * DELETE: Remove quest and cascade to QuestCompletion.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { CONDITION_TEMPLATES } from "../route";

// ─── PATCH: Update a SPECIAL quest ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  // Verify quest exists and is SPECIAL
  const existing = await prisma.quest.findUnique({ where: { id } });
  if (!existing || existing.typ !== "SPECIAL") {
    return NextResponse.json(
      { error: "Special Quest nicht gefunden" },
      { status: 404 },
    );
  }

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
    aktiv,
  } = body;

  // Build update data (only include provided fields)
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (beschreibung !== undefined) updateData.beschreibung = beschreibung || null;
  if (xpBelohnung !== undefined) updateData.xpBelohnung = Number(xpBelohnung);
  if (runenBelohnung !== undefined)
    updateData.runenBelohnung = Number(runenBelohnung);
  if (startDatum !== undefined) updateData.startDatum = new Date(startDatum);
  if (endDatum !== undefined) updateData.endDatum = new Date(endDatum);
  if (aktiv !== undefined) updateData.aktiv = Boolean(aktiv);

  if (targetKlasse !== undefined) {
    updateData.klasse =
      targetKlasse === "ALL" || !targetKlasse ? null : targetKlasse;
  }

  // Rebuild condition if template and count are provided
  if (templateId && count) {
    const template = CONDITION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Unbekannte Vorlage" },
        { status: 400 },
      );
    }
    updateData.bedingung = {
      ...template.condition,
      type: "count",
      count: Number(count),
    };
  }

  const quest = await prisma.quest.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(quest);
}

// ─── DELETE: Remove a SPECIAL quest ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  // Verify quest exists and is SPECIAL
  const existing = await prisma.quest.findUnique({ where: { id } });
  if (!existing || existing.typ !== "SPECIAL") {
    return NextResponse.json(
      { error: "Special Quest nicht gefunden" },
      { status: 404 },
    );
  }

  // Delete completions first, then the quest
  await prisma.questCompletion.deleteMany({ where: { questId: id } });
  await prisma.quest.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
