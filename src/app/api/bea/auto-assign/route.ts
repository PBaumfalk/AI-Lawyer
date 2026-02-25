import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { autoAssignToAkte } from "@/lib/bea/auto-assign";
import { requirePermission } from "@/lib/rbac";
import { z } from "zod";

// ─── Validation ──────────────────────────────────────────────────────────────

const autoAssignSchema = z.object({
  nachrichtId: z.string().min(1, "nachrichtId ist erforderlich"),
});

// ─── POST /api/bea/auto-assign ──────────────────────────────────────────────
// Manually trigger auto-assignment for a beA message.

export async function POST(request: NextRequest) {
  // RBAC: beA auto-assign requires canReadBeA (blocks PRAKTIKANT)
  const authResult = await requirePermission("canReadBeA");
  if (authResult.error) return authResult.error;

  const body = await request.json();
  const parsed = autoAssignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id: parsed.data.nachrichtId },
    select: {
      id: true,
      betreff: true,
      absender: true,
      inhalt: true,
      safeIdAbsender: true,
    },
  });

  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  const assignResult = await autoAssignToAkte({
    betreff: nachricht.betreff,
    absender: nachricht.absender,
    inhalt: nachricht.inhalt,
    safeIdAbsender: nachricht.safeIdAbsender,
  });

  // Update the message with the assignment result
  if (assignResult.akteId) {
    await prisma.beaNachricht.update({
      where: { id: nachricht.id },
      data: {
        akteId: assignResult.akteId,
        status: assignResult.confidence === "SICHER" ? "ZUGEORDNET" : undefined,
      },
    });
  }

  return NextResponse.json({
    akteId: assignResult.akteId,
    confidence: assignResult.confidence,
    reason: assignResult.reason,
  });
}
