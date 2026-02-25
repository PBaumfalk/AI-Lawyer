import { NextRequest, NextResponse } from "next/server";
import { checkConflicts } from "@/lib/conflict-check";
import { requireAkteAccess } from "@/lib/rbac";

// GET /api/akten/[id]/conflict-check?kontaktId=xxx&rolle=MANDANT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access (read)
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const kontaktId = searchParams.get("kontaktId");
  const rolle = searchParams.get("rolle");

  if (!kontaktId || !rolle) {
    return NextResponse.json(
      { error: "kontaktId und rolle sind erforderlich" },
      { status: 400 }
    );
  }

  const result = await checkConflicts(akteId, kontaktId, rolle);
  return NextResponse.json(result);
}
