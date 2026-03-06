/**
 * GET /api/akten/[id]/zusammenfassung
 *
 * Generates an AI-powered case summary (Fallzusammenfassung) for the given Akte.
 * Returns a structured CaseSummary with timeline, key facts, and summary text.
 *
 * On-demand generation -- no caching. User triggers refresh manually.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { generateCaseSummary } from "@/lib/helena/case-summary";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access (internal staff only)
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { session } = access;

  try {
    const summary = await generateCaseSummary({
      prisma,
      akteId,
      userId: session.user.id,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[zusammenfassung] Error generating case summary:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Zusammenfassung" },
      { status: 500 }
    );
  }
}
