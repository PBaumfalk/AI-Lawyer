import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/storage";

/**
 * GET /api/portal/akten/[id]/dokumente/[dId]/download
 * Returns a presigned MinIO download URL for a mandantSichtbar document.
 * Does NOT expose the raw dateipfad to the Mandant.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; dId: string }> }
) {
  const { id: akteId, dId } = await params;

  // Authenticate
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

  // Verify Mandant access to this Akte
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  try {
    // Load document -- must belong to Akte AND be mandantSichtbar
    const dokument = await prisma.dokument.findFirst({
      where: {
        id: dId,
        akteId,
        mandantSichtbar: true,
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        dateipfad: true,
      },
    });

    if (!dokument) {
      return NextResponse.json(
        { error: "Dokument nicht gefunden" },
        { status: 404 }
      );
    }

    // Generate presigned URL (1hr expiry, configured in storage.ts)
    const url = await getDownloadUrl(dokument.dateipfad);

    return NextResponse.json({
      url,
      name: dokument.name,
      mimeType: dokument.mimeType,
    });
  } catch (error) {
    console.error("[PORTAL] Error generating download URL:", error);
    return NextResponse.json(
      { error: "Download fehlgeschlagen" },
      { status: 500 }
    );
  }
}
