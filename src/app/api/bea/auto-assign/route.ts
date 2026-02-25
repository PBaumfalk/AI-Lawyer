import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { autoAssignToAkte } from "@/lib/bea/auto-assign";
import { z } from "zod";

// ─── Validation ──────────────────────────────────────────────────────────────

const autoAssignSchema = z.object({
  nachrichtId: z.string().min(1, "nachrichtId ist erforderlich"),
});

// ─── POST /api/bea/auto-assign ──────────────────────────────────────────────
// Manually trigger auto-assignment for a beA message.

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

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

  const result = await autoAssignToAkte({
    betreff: nachricht.betreff,
    absender: nachricht.absender,
    inhalt: nachricht.inhalt,
    safeIdAbsender: nachricht.safeIdAbsender,
  });

  // Update the message with the assignment result
  if (result.akteId) {
    await prisma.beaNachricht.update({
      where: { id: nachricht.id },
      data: {
        akteId: result.akteId,
        status: result.confidence === "SICHER" ? "ZUGEORDNET" : undefined,
      },
    });
  }

  return NextResponse.json({
    akteId: result.akteId,
    confidence: result.confidence,
    reason: result.reason,
  });
}
