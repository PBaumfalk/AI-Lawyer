import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/audit-trail - System-wide audit trail with cursor pagination and filtering.
 * ADMIN only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const cursor = searchParams.get("cursor");
  const userId = searchParams.get("userId");
  const akteId = searchParams.get("akteId");
  const aktion = searchParams.get("aktion");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const search = searchParams.get("search");

  // Build where clause
  const where: any = {};

  if (userId) where.userId = userId;
  if (akteId) where.akteId = akteId;
  if (aktion) where.aktion = aktion;

  // Date range filter
  if (von || bis) {
    where.createdAt = {};
    if (von) where.createdAt.gte = new Date(von);
    if (bis) {
      const bisDate = new Date(bis);
      bisDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = bisDate;
    }
  }

  // Text search in details JSON (PostgreSQL string contains)
  if (search) {
    where.OR = [
      { details: { path: [], string_contains: search } },
      { user: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, role: true } },
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
    },
  });

  const hasMore = logs.length > take;
  const items = hasMore ? logs.slice(0, take) : logs;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
