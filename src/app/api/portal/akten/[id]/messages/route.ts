import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging/message-service";
import { createPortalChannel } from "@/lib/messaging/channel-service";
import type { MessageListItem } from "@/lib/messaging/types";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
  attachments: z
    .array(
      z.object({
        dokumentId: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Helper: resolve or create the PORTAL channel for this Mandant+Akte pair
// ---------------------------------------------------------------------------

async function resolvePortalChannel(akteId: string, userId: string, userName: string) {
  // Check for existing channel
  const existing = await prisma.channel.findFirst({
    where: { akteId, typ: "PORTAL", mandantUserId: userId },
    select: { id: true },
  });

  if (existing) return { channelId: existing.id };

  // Lazy-create
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { anwaltId: true, kurzrubrum: true },
  });

  if (!akte?.anwaltId) {
    return { error: "Akte hat keinen zustaendigen Anwalt" };
  }

  const result = await createPortalChannel({
    akteId,
    mandantUserId: userId,
    mandantName: userName,
    anwaltUserId: akte.anwaltId,
    akteKurzrubrum: akte.kurzrubrum,
  });

  if (result.error) return { error: result.error };
  return { channelId: result.channel!.id };
}

// ---------------------------------------------------------------------------
// GET /api/portal/akten/[id]/messages -- paginated message history
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: akteId } = await params;

  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  const resolved = await resolvePortalChannel(
    akteId,
    session.user.id,
    session.user.name || "Mandant"
  );
  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const channelId = resolved.channelId!;

  // Parse pagination params
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);

  // Query messages with cursor-based pagination
  const messages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true, isSystem: true },
      },
      parent: {
        select: {
          id: true,
          body: true,
          author: { select: { name: true } },
        },
      },
      reactions: {
        select: { emoji: true, userId: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  const sliced = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  const items: MessageListItem[] = sliced.map((msg) => {
    const reactionMap = new Map<string, string[]>();
    for (const r of msg.reactions) {
      const arr = reactionMap.get(r.emoji) || [];
      arr.push(r.userId);
      reactionMap.set(r.emoji, arr);
    }

    const reactions = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));

    return {
      id: msg.id,
      channelId: msg.channelId,
      authorId: msg.authorId,
      authorName: msg.author.name || "Unbekannt",
      authorAvatarUrl: msg.author.avatarUrl,
      isSystem: msg.author.isSystem,
      body: msg.deletedAt ? "" : msg.body,
      attachments: msg.attachments as unknown[] | null,
      mentions: msg.mentions as string[] | null,
      parentId: msg.parentId,
      parent: msg.parent
        ? {
            id: msg.parent.id,
            authorName: msg.parent.author.name || "Unbekannt",
            body: msg.parent.body,
          }
        : null,
      editedAt: msg.editedAt?.toISOString() ?? null,
      deletedAt: msg.deletedAt?.toISOString() ?? null,
      createdAt: msg.createdAt.toISOString(),
      reactions,
    };
  });

  return NextResponse.json({ messages: items, nextCursor });
}

// ---------------------------------------------------------------------------
// POST /api/portal/akten/[id]/messages -- send message from Mandant
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: akteId } = await params;

  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  const resolved = await resolvePortalChannel(
    akteId,
    session.user.id,
    session.user.name || "Mandant"
  );
  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const channelId = resolved.channelId!;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // IMPORTANT: Do NOT pass mentions from portal messages (no @Helena, no @alle)
  const message = await sendMessage({
    channelId,
    authorId: session.user.id,
    body: parsed.data.body,
    mentions: [], // Strip all mentions from portal messages
    attachments: parsed.data.attachments,
  });

  return NextResponse.json({ message }, { status: 201 });
}
