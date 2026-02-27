import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createRedisConnection } from "@/lib/redis";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("helena-draft-lock");

// ---------------------------------------------------------------------------
// Lazy Redis singleton for lock operations
// ---------------------------------------------------------------------------

let lockRedis: ReturnType<typeof createRedisConnection> | null = null;

function getLockRedis() {
  if (!lockRedis) {
    lockRedis = createRedisConnection();
  }
  return lockRedis;
}

const LOCK_TTL_SECONDS = 300; // 5 minutes
const LOCK_PREFIX = "draft-lock:";

// ---------------------------------------------------------------------------
// POST /api/helena/drafts/[id]/lock -- acquire review lock
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Verify draft exists and user has Akte access
  const draft = await prisma.helenaDraft.findUnique({
    where: { id },
    select: { akteId: true },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Draft nicht gefunden" },
      { status: 404 },
    );
  }

  const akteFilter = buildAkteAccessFilter(
    session.user.id,
    session.user.role,
  );
  const akteAccess = await prisma.akte.findFirst({
    where: { id: draft.akteId, ...akteFilter },
    select: { id: true },
  });

  if (!akteAccess) {
    return NextResponse.json(
      { error: "Draft nicht gefunden" },
      { status: 404 },
    );
  }

  // 3. Try to acquire lock via SET NX EX
  const redis = getLockRedis();
  const lockKey = `${LOCK_PREFIX}${id}`;
  const lockValue = JSON.stringify({
    userId: session.user.id,
    userName: session.user.name,
  });

  try {
    const acquired = await redis.set(
      lockKey,
      lockValue,
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    );

    if (!acquired) {
      // Lock already held -- return who holds it
      const existingLock = await redis.get(lockKey);
      let lockedBy = { userId: "unknown", userName: "Unbekannt" };
      try {
        if (existingLock) {
          lockedBy = JSON.parse(existingLock);
        }
      } catch {
        // Ignore parse error
      }

      return NextResponse.json(
        {
          locked: true,
          lockedBy,
          message: `Wird von ${lockedBy.userName} geprueft`,
        },
        { status: 409 },
      );
    }

    // 4. Emit lock event via Socket.IO
    try {
      const emitter = getSocketEmitter();
      emitter.to(`akte:${draft.akteId}`).emit("draft:locked", {
        draftId: id,
        userId: session.user.id,
        userName: session.user.name,
      });
    } catch (emitErr) {
      // Non-blocking -- lock is acquired even if emit fails
      log.warn({ err: emitErr }, "Failed to emit draft:locked event");
    }

    return NextResponse.json({
      locked: true,
      ownLock: true,
      expiresIn: LOCK_TTL_SECONDS,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errMsg, draftId: id }, "Failed to acquire draft lock");

    // Fail open: if Redis is down, allow the action
    return NextResponse.json({
      locked: false,
      warning: "Lock-Service nicht verfuegbar",
    });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/helena/drafts/[id]/lock -- release review lock
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Check lock ownership
  const redis = getLockRedis();
  const lockKey = `${LOCK_PREFIX}${id}`;

  try {
    const existingLock = await redis.get(lockKey);

    if (!existingLock) {
      return NextResponse.json({ released: true }); // Already unlocked
    }

    let lockData: { userId?: string } = {};
    try {
      lockData = JSON.parse(existingLock);
    } catch {
      // Corrupted lock -- allow release
    }

    // Only the lock owner (or ADMIN) can release
    if (
      lockData.userId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Nur der Sperrinhaber kann die Sperre aufheben" },
        { status: 403 },
      );
    }

    await redis.del(lockKey);

    // 3. Verify draft exists for Socket.IO room name
    const draft = await prisma.helenaDraft.findUnique({
      where: { id },
      select: { akteId: true },
    });

    // 4. Emit unlock event
    if (draft) {
      try {
        const emitter = getSocketEmitter();
        emitter.to(`akte:${draft.akteId}`).emit("draft:unlocked", {
          draftId: id,
          userId: session.user.id,
        });
      } catch (emitErr) {
        log.warn({ err: emitErr }, "Failed to emit draft:unlocked event");
      }
    }

    return NextResponse.json({ released: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errMsg, draftId: id }, "Failed to release draft lock");

    return NextResponse.json({
      released: false,
      warning: "Lock-Service nicht verfuegbar",
    });
  }
}
