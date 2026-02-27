import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

// DELETE /api/akten/[id]/normen/[normId] -- remove a pinned norm from an Akte
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; normId: string }> }
) {
  const { id: akteId, normId } = await params;

  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  // Find the norm and verify it belongs to this Akte
  const norm = await prisma.akteNorm.findUnique({
    where: { id: normId },
  });

  if (!norm || norm.akteId !== akteId) {
    return NextResponse.json(
      { error: "Norm nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.akteNorm.delete({
    where: { id: normId },
  });

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "NORM_ENTFERNT",
    details: {
      gesetzKuerzel: norm.gesetzKuerzel,
      paragraphNr: norm.paragraphNr,
    },
  });

  return new NextResponse(null, { status: 204 });
}
