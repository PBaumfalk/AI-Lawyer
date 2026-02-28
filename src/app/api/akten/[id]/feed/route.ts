import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";
import { AktenActivityTyp, Prisma, type UserRole } from "@prisma/client";
import { parseHelenaMention } from "@/lib/helena/at-mention-parser";
import { createHelenaTask } from "@/lib/helena/task-service";
import { getSocketEmitter } from "@/lib/socket/emitter";

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

// POST /api/akten/[id]/feed -- create note + optionally trigger Helena task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const session = access.session;

  try {
    const body = await request.json();
    const text = body?.text;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text erforderlich" },
        { status: 400 }
      );
    }

    // 1. Always create NOTIZ activity entry
    const activity = await prisma.aktenActivity.create({
      data: {
        akteId,
        userId: session.user.id,
        typ: "NOTIZ",
        titel: text.slice(0, 100),
        inhalt: text,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    // Emit Socket.IO event for real-time feed updates
    try {
      getSocketEmitter()
        .to(`akte:${akteId}`)
        .emit("akten-activity:new", {
          akteId,
          activityId: activity.id,
          typ: activity.typ,
        });
    } catch {
      // Socket.IO not available -- non-critical
    }

    // 2. Check for @Helena mention
    let taskId: string | null = null;
    const helenaInstruction = parseHelenaMention(text);

    if (helenaInstruction) {
      try {
        const task = await createHelenaTask({
          userId: session.user.id,
          userRole: session.user.role as UserRole,
          userName: session.user.name ?? "Benutzer",
          akteId,
          auftrag: helenaInstruction,
          prioritaet: 8, // Manual @-tag gets high priority
          quelle: "at-mention",
        });
        taskId = task.id;
      } catch (error) {
        // Fail-open: note was created, just Helena task failed
        console.error("[FEED] Failed to create Helena task:", error);
      }
    }

    return NextResponse.json({ activity, taskId }, { status: 201 });
  } catch (error) {
    console.error("[FEED] Error creating note:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Notiz" },
      { status: 500 }
    );
  }
}
