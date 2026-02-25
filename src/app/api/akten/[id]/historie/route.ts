import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";

// GET /api/akten/[id]/historie -- paginated audit log with optional filter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access (read)
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "20"), 100);
  const cursor = searchParams.get("cursor"); // id of the last item for cursor-based pagination
  const aktion = searchParams.get("aktion"); // filter by action type

  const where: any = { akteId };
  if (aktion) {
    const aktionen = aktion.split(",").map((s: string) => s.trim()).filter(Boolean);
    where.aktion = aktionen.length === 1 ? aktionen[0] : { in: aktionen };
  }

  const dokumentId = searchParams.get("dokumentId");
  if (dokumentId) {
    where.details = { path: ["dokumentId"], equals: dokumentId };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1, // fetch one extra to check if there are more
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // skip the cursor item itself
        }
      : {}),
    include: {
      user: { select: { name: true } },
    },
  });

  const hasMore = logs.length > take;
  const items = hasMore ? logs.slice(0, take) : logs;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    items,
    nextCursor,
    hasMore,
  });
}
