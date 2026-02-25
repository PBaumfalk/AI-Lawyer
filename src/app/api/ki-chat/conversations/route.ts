/**
 * GET/POST /api/ki-chat/conversations
 *
 * Conversation CRUD for the Helena chat system.
 * GET: List conversations for the current user (optional akteId filter, cursor-based pagination).
 * POST: Create a new conversation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET — List conversations
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const akteId = searchParams.get("akteId");
  const cursor = searchParams.get("cursor");
  const take = 50;

  const where: any = { userId };
  if (akteId) where.akteId = akteId;

  const conversations = await prisma.aiConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: take + 1, // Fetch one extra for cursor detection
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      akteId: true,
      titel: true,
      updatedAt: true,
      messages: true,
      akte: {
        select: {
          aktenzeichen: true,
          kurzrubrum: true,
        },
      },
    },
  });

  const hasMore = conversations.length > take;
  const items = hasMore ? conversations.slice(0, take) : conversations;

  const result = items.map((c) => ({
    id: c.id,
    akteId: c.akteId,
    titel: c.titel,
    updatedAt: c.updatedAt,
    messageCount: Array.isArray(c.messages) ? (c.messages as any[]).length : 0,
    akte: c.akte
      ? {
          aktenzeichen: c.akte.aktenzeichen,
          kurzrubrum: c.akte.kurzrubrum,
        }
      : null,
  }));

  return NextResponse.json({
    conversations: result,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

// ---------------------------------------------------------------------------
// POST — Create new conversation
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { akteId, titel } = body as {
    akteId?: string | null;
    titel?: string;
  };

  const conversation = await prisma.aiConversation.create({
    data: {
      akteId: akteId ?? null,
      userId,
      titel: titel ?? "Neue Unterhaltung",
      messages: [],
      model: "pending", // Will be updated on first message
      tokenCount: 0,
    },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
