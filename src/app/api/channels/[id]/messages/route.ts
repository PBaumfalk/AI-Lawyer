import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging/message-service";
import type { MessageListItem } from "@/lib/messaging/types";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
  mentions: z.array(z.string()).optional().default([]),
  attachments: z
    .array(
      z.object({
        dokumentId: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  parentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the user has access to the channel.
 *
 * - For AKTE channels: uses requireAkteAccess() as the single source of truth.
 * - For ALLGEMEIN channels: checks ChannelMember row (or ADMIN role).
 *
 * Returns the channel record on success or an error NextResponse.
 */
async function verifyChannelAccess(
  channelId: string,
  userId: string,
  userRole: string,
): Promise<
  | { channel: { id: string; typ: string; akteId: string | null }; error?: undefined }
  | { channel?: undefined; error: NextResponse }
> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, typ: true, akteId: true },
  });

  if (!channel) {
    return {
      error: NextResponse.json({ error: "Kanal nicht gefunden" }, { status: 404 }),
    };
  }

  // AKTE channels: requireAkteAccess is the authoritative gate
  if (channel.typ === "AKTE" && channel.akteId) {
    const akteResult = await requireAkteAccess(channel.akteId);
    if (akteResult.error) {
      return { error: akteResult.error };
    }
    return { channel };
  }

  // ALLGEMEIN channels: check ChannelMember row or ADMIN bypass
  if (userRole === "ADMIN") {
    return { channel };
  }

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  });

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Du bist kein Mitglied dieses Kanals" },
        { status: 403 },
      ),
    };
  }

  return { channel };
}

// ---------------------------------------------------------------------------
// GET /api/channels/{id}/messages -- Paginated message history
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id: channelId } = await params;

  const accessResult = await verifyChannelAccess(
    channelId,
    session.user.id,
    session.user.role,
  );
  if (accessResult.error) return accessResult.error;

  // Parse pagination params
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);

  // Query messages with cursor-based pagination
  const messages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine nextCursor
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // Skip the cursor message itself
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

  // Determine if there are more messages
  const hasMore = messages.length > limit;
  const sliced = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  // Transform to MessageListItem DTO
  const items: MessageListItem[] = sliced.map((msg) => {
    // Group reactions by emoji
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
      // Soft-deleted messages: replace body with empty string (UI handles display label)
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
// POST /api/channels/{id}/messages -- Send a message
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id: channelId } = await params;

  const accessResult = await verifyChannelAccess(
    channelId,
    session.user.id,
    session.user.role,
  );
  if (accessResult.error) return accessResult.error;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 },
    );
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { body: msgBody, mentions, attachments, parentId } = parsed.data;

  // Validate parentId references a message in the same channel
  if (parentId) {
    const parentMsg = await prisma.message.findUnique({
      where: { id: parentId },
      select: { channelId: true },
    });
    if (!parentMsg || parentMsg.channelId !== channelId) {
      return NextResponse.json(
        { error: "Referenzierte Nachricht nicht in diesem Kanal gefunden" },
        { status: 400 },
      );
    }
  }

  const message = await sendMessage({
    channelId,
    authorId: session.user.id,
    body: msgBody,
    mentions,
    attachments,
    parentId,
  });

  return NextResponse.json({ message }, { status: 201 });
}
