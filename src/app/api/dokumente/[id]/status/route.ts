import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DokumentStatus } from "@prisma/client";

/**
 * Valid document status transitions.
 * ENTWURF -> ZUR_PRUEFUNG: any user with edit access
 * ZUR_PRUEFUNG -> FREIGEGEBEN: only ANWALT or ADMIN (Freigabe only by Anwalt)
 * FREIGEGEBEN -> VERSENDET: any user with edit access
 * FREIGEGEBEN -> ENTWURF: only ANWALT or ADMIN (revert Freigabe)
 */
const VALID_TRANSITIONS: Record<DokumentStatus, DokumentStatus[]> = {
  ENTWURF: [DokumentStatus.ZUR_PRUEFUNG],
  ZUR_PRUEFUNG: [DokumentStatus.FREIGEGEBEN],
  FREIGEGEBEN: [DokumentStatus.VERSENDET, DokumentStatus.ENTWURF],
  VERSENDET: [],
};

/** Transitions that require ANWALT or ADMIN role */
const RESTRICTED_TRANSITIONS = new Set([
  `ZUR_PRUEFUNG->FREIGEGEBEN`,
  `FREIGEGEBEN->ENTWURF`,
]);

/**
 * PATCH /api/dokumente/[id]/status -- Transition document status.
 * Enforces valid transitions and RBAC for Freigabe/revert.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const userRole = (session.user as Record<string, unknown>).role as string;
  const userId = session.user.id!;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const targetStatus = body.status as DokumentStatus | undefined;
  if (!targetStatus || !Object.values(DokumentStatus).includes(targetStatus)) {
    return NextResponse.json(
      {
        error: `Ungueltiger Status. Erlaubt: ${Object.values(DokumentStatus).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, akteId: true },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if transition is valid
  const allowedTargets = VALID_TRANSITIONS[dokument.status] ?? [];
  if (!allowedTargets.includes(targetStatus)) {
    return NextResponse.json(
      {
        error: `Uebergang von ${dokument.status} nach ${targetStatus} ist nicht erlaubt. Erlaubte Uebergaenge: ${allowedTargets.join(", ") || "keine"}`,
      },
      { status: 400 }
    );
  }

  // Check role restrictions for Freigabe and revert
  const transitionKey = `${dokument.status}->${targetStatus}`;
  if (RESTRICTED_TRANSITIONS.has(transitionKey)) {
    if (userRole !== "ANWALT" && userRole !== "ADMIN") {
      return NextResponse.json(
        {
          error: `Nur Anwalt oder Admin kann den Uebergang ${dokument.status} -> ${targetStatus} durchfuehren`,
        },
        { status: 403 }
      );
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: new Date(),
  };

  // Set Freigabe tracking fields
  if (targetStatus === DokumentStatus.FREIGEGEBEN) {
    updateData.freigegebenDurchId = userId;
    updateData.freigegebenAm = new Date();
  }

  // Clear Freigabe tracking on revert to ENTWURF
  if (
    dokument.status === DokumentStatus.FREIGEGEBEN &&
    targetStatus === DokumentStatus.ENTWURF
  ) {
    updateData.freigegebenDurchId = null;
    updateData.freigegebenAm = null;
  }

  // Perform the transition
  const updated = await prisma.dokument.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, status: true },
  });

  // Audit log for status transition
  await prisma.auditLog.create({
    data: {
      userId,
      akteId: dokument.akteId,
      aktion: "DOKUMENT_STATUS_GEAENDERT",
      details: {
        dokumentId: dokument.id,
        dokumentName: dokument.name,
        vonStatus: dokument.status,
        nachStatus: targetStatus,
      },
    },
  });

  console.log(
    `[Dokument-Status] ${dokument.name}: ${dokument.status} -> ${targetStatus} by ${userId} (${userRole})`
  );

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    status: updated.status,
    transition: `${dokument.status} -> ${targetStatus}`,
  });
}
