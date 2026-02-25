import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

// --- POST /api/bea/messages/[id]/eeb ---
// Records the eEB (elektronisches Empfangsbekenntnis) acknowledgment.
// The actual eEB call to bea.expert happens client-side.
// This route validates and persists the result.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC: Only ANWALT or ADMIN can acknowledge eEB
  const result = await requireRole("ANWALT", "ADMIN");
  if (result.error) return result.error;

  const { id } = await params;

  const nachricht = await prisma.beaNachricht.findUnique({
    where: { id },
    select: { id: true, eebStatus: true },
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

  const eebDatum = new Date();

  await prisma.beaNachricht.update({
    where: { id },
    data: {
      eebStatus: "BESTAETIGT",
      eebDatum,
    },
  });

  return NextResponse.json({
    success: true,
    eebDatum: eebDatum.toISOString(),
    message: "Empfangsbekenntnis erfolgreich bestaetigt",
  });
}
