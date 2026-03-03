import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { triggerPortalNotificationForAkte } from "@/lib/portal/trigger-portal-notification";

/**
 * PATCH /api/akten/[id]/dokumente/[dId]/mandant-sichtbar
 * Toggle mandantSichtbar flag on a Dokument.
 * Only ADMIN, ANWALT, SACHBEARBEITER can toggle (enforced via requireAkteAccess requireEdit).
 * When enabling: creates an AktenActivity visible to the Mandant.
 * When disabling: no activity created (Mandant should not see revocations).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dId: string }> }
) {
  const { id: akteId, dId } = await params;

  // RBAC: only users with edit access (ADMIN, ANWALT, SACHBEARBEITER) can toggle
  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;

  const { session } = access;

  // Parse body
  let body: { mandantSichtbar?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  if (typeof body.mandantSichtbar !== "boolean") {
    return NextResponse.json(
      { error: "mandantSichtbar muss ein Boolean sein" },
      { status: 400 }
    );
  }

  // Verify the Dokument belongs to this Akte
  const dokument = await prisma.dokument.findFirst({
    where: { id: dId, akteId },
    select: { id: true, name: true, mandantSichtbar: true },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // No-op if already in desired state
  if (dokument.mandantSichtbar === body.mandantSichtbar) {
    return NextResponse.json({ dokument });
  }

  // Update the field
  const updated = await prisma.dokument.update({
    where: { id: dId },
    data: { mandantSichtbar: body.mandantSichtbar },
  });

  // When toggling TO true: create an AktenActivity visible to Mandant
  if (body.mandantSichtbar) {
    await prisma.aktenActivity.create({
      data: {
        akteId,
        userId: session.user.id,
        typ: "DOKUMENT",
        titel: `Dokument "${dokument.name}" fuer Mandant freigegeben`,
        mandantSichtbar: true,
        meta: { dokumentId: dId, mandantSichtbar: true },
      },
    });

    // MSG-05: Notify Mandant via email when document is shared
    triggerPortalNotificationForAkte(
      akteId,
      "neues-dokument",
      `/akten/${akteId}/dokumente`,
    ).catch(() => {}); // Fire-and-forget
  }
  // When toggling TO false: NO activity (Mandant should not see revocations)

  // Audit log for both directions
  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "DOKUMENT_STATUS_GEAENDERT",
    details: {
      dokumentId: dId,
      dokumentName: dokument.name,
      mandantSichtbar: body.mandantSichtbar,
    },
  });

  return NextResponse.json({ dokument: updated });
}
