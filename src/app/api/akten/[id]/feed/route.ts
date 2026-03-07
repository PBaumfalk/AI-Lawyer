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
    const typ = (body?.typ as string) ?? "NOTIZ";
    const meta = body?.meta as Record<string, unknown> | undefined;

    // Validate by typ
    if (typ === "TELEFONNOTIZ") {
      if (!meta?.beteiligter || typeof meta.beteiligter !== "string" || !String(meta.beteiligter).trim()) {
        return NextResponse.json({ error: "Beteiligter erforderlich" }, { status: 400 });
      }
      if (!meta?.ergebnis || typeof meta.ergebnis !== "string" || !String(meta.ergebnis).trim()) {
        return NextResponse.json({ error: "Ergebnis erforderlich" }, { status: 400 });
      }
    } else if (typ === "AUFGABE") {
      if (!meta?.titel || typeof meta.titel !== "string" || !String(meta.titel).trim()) {
        return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 });
      }
    } else {
      // NOTIZ -- text required
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return NextResponse.json({ error: "Text erforderlich" }, { status: 400 });
      }
    }

    // Determine titel and inhalt based on typ
    let titel: string;
    let inhalt: string | null;

    if (typ === "TELEFONNOTIZ") {
      titel = `Telefonnotiz: ${String(meta!.beteiligter).trim()}`;
      inhalt = (meta?.stichworte as string) || null;
    } else if (typ === "AUFGABE") {
      titel = String(meta!.titel).trim().slice(0, 100);
      inhalt = (meta?.beschreibung as string) || null;
    } else {
      titel = text!.slice(0, 100);
      inhalt = text!;
    }

    // 1. Create activity entry
    const activity = await prisma.aktenActivity.create({
      data: {
        akteId,
        userId: session.user.id,
        typ: typ as AktenActivityTyp,
        titel,
        inhalt,
        ...(meta ? { meta: meta as Prisma.InputJsonValue } : {}),
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

    // 2. Check for @Helena mention (only for NOTIZ typ)
    let taskId: string | null = null;
    if (typ === "NOTIZ") {
      const helenaInstruction = parseHelenaMention(text!);

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
