import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getSocketEmitter } from "@/lib/socket/emitter";
import type { HelenaAlertTyp } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/helena/alerts -- list alerts with filters and pagination
// PATCH /api/helena/alerts -- bulk mark all visible alerts as read
// ---------------------------------------------------------------------------

const VALID_TYPES: Set<string> = new Set([
  "FRIST_KRITISCH",
  "AKTE_INAKTIV",
  "BETEILIGTE_FEHLEN",
  "DOKUMENT_FEHLT",
  "WIDERSPRUCH",
  "NEUES_URTEIL",
]);

export async function GET(request: NextRequest) {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const typ = searchParams.get("typ");
  const akteId = searchParams.get("akteId");
  const gelesen = searchParams.get("gelesen");
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

  if (typ && VALID_TYPES.has(typ)) {
    where.typ = typ as HelenaAlertTyp;
  }

  if (akteId) {
    where.akteId = akteId;
  }

  const prioritaetParam = searchParams.get("prioritaet");
  if (prioritaetParam) {
    const minPrio = Math.max(1, Math.min(10, parseInt(prioritaetParam, 10)));
    if (!isNaN(minPrio)) {
      where.prioritaet = { gte: minPrio };
    }
  }

  if (gelesen === "true") where.gelesen = true;
  if (gelesen === "false") where.gelesen = false;

  // 4. Query with pagination
  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    prisma.helenaAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        akte: {
          select: { id: true, aktenzeichen: true, kurzrubrum: true },
        },
      },
    }),
    prisma.helenaAlert.count({ where }),
  ]);

  return NextResponse.json({
    alerts,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function PATCH() {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Bulk mark all accessible unread alerts as read
  const akteFilter = buildAkteAccessFilter(
    session.user.id,
    session.user.role,
  );

  const updated = await prisma.helenaAlert.updateMany({
    where: { akte: akteFilter, gelesen: false },
    data: { gelesen: true, gelesenAt: new Date() },
  });

  // 3. Emit badge count update via Socket.IO
  try {
    getSocketEmitter()
      .to(`user:${session.user.id}`)
      .emit("helena:alert-badge", { count: 0 });
  } catch {
    // Non-critical -- badge will update on next fetch
  }

  return NextResponse.json({ updated: updated.count });
}
