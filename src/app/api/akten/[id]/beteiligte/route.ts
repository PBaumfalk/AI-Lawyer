import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { requireAkteAccess } from "@/lib/rbac";
import { z } from "zod";

const addBeteiligterSchema = z.object({
  kontaktId: z.string().min(1, "Kontakt ist erforderlich"),
  rolle: z.enum([
    "MANDANT",
    "GEGNER",
    "GEGNERVERTRETER",
    "GERICHT",
    "ZEUGE",
    "SACHVERSTAENDIGER",
    "SONSTIGER",
  ]),
  notizen: z.string().optional(),
});

// POST /api/akten/[id]/beteiligte -- add party to case
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access with edit permission
  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const body = await request.json();
  const parsed = addBeteiligterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the Kontakt exists
  const kontakt = await prisma.kontakt.findUnique({
    where: { id: parsed.data.kontaktId },
  });
  if (!kontakt) {
    return NextResponse.json(
      { error: "Kontakt nicht gefunden" },
      { status: 404 }
    );
  }

  // Check for duplicates
  const existing = await prisma.beteiligter.findUnique({
    where: {
      akteId_kontaktId_rolle: {
        akteId,
        kontaktId: parsed.data.kontaktId,
        rolle: parsed.data.rolle,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Dieser Kontakt ist bereits in dieser Rolle zugewiesen" },
      { status: 409 }
    );
  }

  const beteiligter = await prisma.beteiligter.create({
    data: {
      akteId,
      kontaktId: parsed.data.kontaktId,
      rolle: parsed.data.rolle,
      notizen: parsed.data.notizen || null,
    },
    include: { kontakt: true },
  });

  // Audit log
  const kontaktName = kontakt.typ === "NATUERLICH"
    ? `${kontakt.vorname ?? ""} ${kontakt.nachname ?? ""}`.trim()
    : kontakt.firma ?? kontakt.nachname ?? "";

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "BETEILIGTER_HINZUGEFUEGT",
    details: {
      kontakt: kontaktName,
      rolle: parsed.data.rolle,
    },
  });

  return NextResponse.json(beteiligter, { status: 201 });
}

// DELETE /api/akten/[id]/beteiligte -- remove party from case
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access with edit permission
  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const { searchParams } = new URL(request.url);
  const beteiligterIdParam = searchParams.get("beteiligterID");

  if (!beteiligterIdParam) {
    return NextResponse.json(
      { error: "beteiligterID ist erforderlich" },
      { status: 400 }
    );
  }

  const beteiligter = await prisma.beteiligter.findFirst({
    where: { id: beteiligterIdParam, akteId },
    include: { kontakt: { select: { typ: true, vorname: true, nachname: true, firma: true } } },
  });

  if (!beteiligter) {
    return NextResponse.json(
      { error: "Beteiligter nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.beteiligter.delete({
    where: { id: beteiligterIdParam },
  });

  // Audit log
  const kontaktName = beteiligter.kontakt.typ === "NATUERLICH"
    ? `${beteiligter.kontakt.vorname ?? ""} ${beteiligter.kontakt.nachname ?? ""}`.trim()
    : beteiligter.kontakt.firma ?? beteiligter.kontakt.nachname ?? "";

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "BETEILIGTER_ENTFERNT",
    details: {
      kontakt: kontaktName,
      rolle: beteiligter.rolle,
    },
  });

  return NextResponse.json({ success: true });
}
