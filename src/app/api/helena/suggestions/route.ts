/**
 * GET /api/helena/suggestions
 *
 * Returns Helena suggestions for the current user.
 * Supports filtering by status, akteId, typ, and cursor-based pagination.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "NEU";
  const akteId = searchParams.get("akteId");
  const typ = searchParams.get("typ");
  const emailId = searchParams.get("emailId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const cursor = searchParams.get("cursor");

  const where: any = {
    userId: session.user.id,
  };

  // Status filter (allow "ALLE" to skip)
  if (status && status !== "ALLE") {
    where.status = status;
  }

  if (akteId) where.akteId = akteId;
  if (typ) where.typ = typ;
  if (emailId) where.emailId = emailId;

  // Cursor-based pagination
  const findOptions: any = {
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine if there are more
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  };

  if (cursor) {
    findOptions.cursor = { id: cursor };
    findOptions.skip = 1; // Skip the cursor item itself
  }

  const suggestions = await prisma.helenaSuggestion.findMany(findOptions);

  // Determine if there are more results
  let nextCursor: string | null = null;
  if (suggestions.length > limit) {
    const extra = suggestions.pop();
    nextCursor = extra!.id;
  }

  // Count NEU suggestions for badge
  const neuCount = await prisma.helenaSuggestion.count({
    where: { userId: session.user.id, status: "NEU" },
  });

  return NextResponse.json({
    suggestions,
    nextCursor,
    neuCount,
  });
}
