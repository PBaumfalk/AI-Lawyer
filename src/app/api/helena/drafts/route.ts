import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import type { HelenaDraftStatus, HelenaDraftTyp } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/helena/drafts -- list drafts with filters and pagination
// ---------------------------------------------------------------------------

const VALID_STATUSES: Set<string> = new Set([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "EDITED",
]);

const VALID_TYPES: Set<string> = new Set([
  "DOKUMENT",
  "FRIST",
  "NOTIZ",
  "ALERT",
]);

export async function GET(request: NextRequest) {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const akteId = searchParams.get("akteId");
  const typ = searchParams.get("typ");
  const status = searchParams.get("status") ?? "PENDING";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );

  // 3. Build WHERE clause with RBAC
  const akteFilter = buildAkteAccessFilter(
    session.user.id,
    session.user.role,
  );

  const where: Record<string, unknown> = {
    akte: akteFilter,
  };

  if (akteId) {
    where.akteId = akteId;
  }

  if (typ && VALID_TYPES.has(typ)) {
    where.typ = typ as HelenaDraftTyp;
  }

  if (status && VALID_STATUSES.has(status)) {
    where.status = status as HelenaDraftStatus;
  }

  // 4. Query with pagination
  const skip = (page - 1) * limit;

  const [drafts, total] = await Promise.all([
    prisma.helenaDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        akte: {
          select: { id: true, aktenzeichen: true, kurzrubrum: true },
        },
      },
    }),
    prisma.helenaDraft.count({ where }),
  ]);

  return NextResponse.json({ drafts, total, page, limit });
}
