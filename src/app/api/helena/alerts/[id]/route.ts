import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getSocketEmitter } from "@/lib/socket/emitter";

// ---------------------------------------------------------------------------
// PATCH /api/helena/alerts/[id] -- dismiss single alert with optional comment
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;

  // 2. Parse optional body
  let comment: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.comment === "string") {
      comment = body.comment;
    }
  } catch {
    // Empty body is fine -- comment is optional
  }

  // 3. Load alert
  const alert = await prisma.helenaAlert.findUnique({
    where: { id },
    select: { id: true, akteId: true, userId: true, gelesen: true, meta: true },
  });

  if (!alert) {
    return NextResponse.json(
      { error: "Alert nicht gefunden" },
      { status: 404 },
    );
  }

  // 4. Verify Akte access via RBAC
  const akteFilter = buildAkteAccessFilter(
    session.user.id,
    session.user.role,
  );

  const akteAccess = await prisma.akte.findFirst({
    where: { id: alert.akteId, ...akteFilter },
    select: { id: true },
  });

  if (!akteAccess) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // 5. Idempotent dismiss -- if already read, return as-is
  if (alert.gelesen) {
    const existing = await prisma.helenaAlert.findUnique({
      where: { id },
      include: {
        akte: {
          select: { id: true, aktenzeichen: true, kurzrubrum: true },
        },
      },
    });
    return NextResponse.json(existing);
  }

  // 6. Update alert with dismiss metadata
  const existingMeta = (alert.meta as Record<string, unknown>) ?? {};
  const updatedAlert = await prisma.helenaAlert.update({
    where: { id },
    data: {
      gelesen: true,
      gelesenAt: new Date(),
      meta: {
        ...existingMeta,
        dismissedBy: session.user.id,
        dismissedAt: new Date().toISOString(),
        ...(comment ? { dismissComment: comment } : {}),
      },
    },
    include: {
      akte: {
        select: { id: true, aktenzeichen: true, kurzrubrum: true },
      },
    },
  });

  // 7. Emit updated badge count via Socket.IO
  try {
    const unreadCount = await prisma.helenaAlert.count({
      where: { userId: alert.userId, gelesen: false },
    });

    getSocketEmitter()
      .to(`user:${alert.userId}`)
      .emit("helena:alert-badge", { count: unreadCount });
  } catch {
    // Non-critical -- badge will update on next fetch
  }

  return NextResponse.json(updatedAlert);
}
