import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { eebBestaetigungSchema } from "@/lib/bea/versand";

// --- POST /api/bea/messages/[id]/eeb ---
// Records the eEB (elektronisches Empfangsbekenntnis) acknowledgment.
// The actual eEB call to bea.expert happens client-side.
// This route validates and persists the result.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC: Only ANWALT or ADMIN can acknowledge eEB
  const result = await requireRole("ANWALT", "ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    select: { id: true, eebStatus: true, betreff: true, safeIdAbsender: true, akteId: true, nachrichtenId: true },
  });

  if (!nachricht) {
    return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
  }

  if (nachricht.eebStatus === "BESTAETIGT") {
    return NextResponse.json(
      { error: "Empfangsbekenntnis wurde bereits bestaetigt" },
      { status: 409 }
    );
  }

  // The eEB must have been confirmed by bea.expert for exactly this message.
  const parsed = eebBestaetigungSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "eEB-Bestaetigung von beA fehlt", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (!nachricht.nachrichtenId) {
    return NextResponse.json(
      { error: "Nachricht hat keine beA-Nachrichten-ID; eEB kann nicht zugeordnet werden" },
      { status: 409 }
    );
  }
  if (parsed.data.nachrichtenId !== nachricht.nachrichtenId) {
    return NextResponse.json(
      { error: "eEB-Bestaetigung gehoert zu einer anderen beA-Nachricht" },
      { status: 400 }
    );
  }
  const eebDatum = new Date(parsed.data.eebDatum);

  await prisma.beaNachricht.update({
    where: { id },
    data: {
      eebStatus: "BESTAETIGT",
      eebDatum,
    },
  });

  // Audit log: eEB confirmed
  logAuditEvent({
    userId: result.session!.user.id,
    akteId: nachricht.akteId,
    aktion: "BEA_EEB_BESTAETIGT",
    details: {
      nachrichtId: id,
      betreff: nachricht.betreff,
      senderSafeId: nachricht.safeIdAbsender || null,
      eebDatum: eebDatum.toISOString(),
      ergebnis: "ERFOLG",
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    eebDatum: eebDatum.toISOString(),
    message: "Empfangsbekenntnis erfolgreich bestaetigt",
  });
}
