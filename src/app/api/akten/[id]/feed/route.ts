import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { AktenActivityTyp, Prisma } from "@prisma/client";

// GET /api/akten/[id]/feed -- paginated activity feed with optional type filter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access (returns 404-as-403 if unauthorized)
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  try {
    const { searchParams } = new URL(request.url);
    const take = Math.min(parseInt(searchParams.get("take") ?? "20"), 100);
    const cursor = searchParams.get("cursor");
    const typ = searchParams.get("typ"); // Comma-separated AktenActivityTyp values

    // Build where filter
    const where: Prisma.AktenActivityWhereInput = { akteId };
    if (typ) {
      const types = typ
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as AktenActivityTyp[];
      if (types.length === 1) {
        where.typ = types[0];
      } else if (types.length > 1) {
        where.typ = { in: types };
      }
    }

    // Cursor-paginated query (reverse chronological)
    const entries = await prisma.aktenActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1, // fetch one extra to determine hasMore
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { id: true, name: true } } },
    });

    const hasMore = entries.length > take;
    const items = hasMore ? entries.slice(0, take) : entries;

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    });
  } catch (error) {
    console.error("[FEED] Error fetching activity feed:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Feeds" },
      { status: 500 }
    );
  }
}
