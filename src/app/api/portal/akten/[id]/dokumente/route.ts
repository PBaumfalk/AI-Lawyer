import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";

/**
 * GET /api/portal/akten/[id]/dokumente
 * Returns only mandantSichtbar=true documents for the authenticated Mandant.
 * Does NOT return dateipfad (MinIO path) -- downloads handled by separate endpoint.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { session } = authResult;

  // Only MANDANT users may access portal endpoints
  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  // Verify Mandant access to this specific Akte (returns 404 if unauthorized)
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  try {
    const dokumente = await prisma.dokument.findMany({
      where: {
        akteId,
        mandantSichtbar: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        groesse: true,
        createdAt: true,
        ordner: true,
        // Do NOT return dateipfad -- only exposed through download endpoint (Plan 46-02)
      },
    });

    return NextResponse.json({ dokumente });
  } catch (error) {
    console.error("[PORTAL] Error fetching dokumente:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Dokumente" },
      { status: 500 }
    );
  }
}
