import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";

// GET /api/portal/akten/[id]/timeline -- Mandant-visible timeline events
// Only returns activities with mandantSichtbar=true
// Cursor-based pagination (same pattern as /api/akten/[id]/feed)
export async function GET(
  request: NextRequest,
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
    const { searchParams } = new URL(request.url);
    const take = Math.min(parseInt(searchParams.get("take") ?? "20"), 100);
    const cursor = searchParams.get("cursor");

    // CRITICAL: Only show mandantSichtbar=true activities
    const entries = await prisma.aktenActivity.findMany({
      where: {
        akteId,
        mandantSichtbar: true,
      },
      orderBy: { createdAt: "desc" },
      take: take + 1, // fetch one extra to determine hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        typ: true,
        titel: true,
        inhalt: true,
        createdAt: true,
        // NO user info, NO meta details exposed to Mandant
      },
    });

    const hasMore = entries.length > take;
    const items = hasMore ? entries.slice(0, take) : entries;

    // Truncate inhalt for list view (full content via separate endpoint if needed)
    const truncatedItems = items.map((item) => ({
      ...item,
      inhalt: item.inhalt
        ? item.inhalt.length > 500
          ? item.inhalt.slice(0, 500) + "..."
          : item.inhalt
        : null,
    }));

    return NextResponse.json({
      items: truncatedItems,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error("[PORTAL] Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Timeline" },
      { status: 500 }
    );
  }
}
