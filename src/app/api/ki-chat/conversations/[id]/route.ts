/**
 * GET/PATCH/DELETE /api/ki-chat/conversations/[id]
 *
 * Single conversation operations.
 * GET: Return full conversation with messages (RBAC: owner or Akte access).
 * PATCH: Update titel or append messages.
 * DELETE: Delete conversation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Auth helper — owner check + Akte RBAC for shared conversations
// ---------------------------------------------------------------------------

async function checkAccess(
  conversationId: string,
  userId: string
): Promise<{
  allowed: boolean;
  isOwner: boolean;
  conversation: any;
}> {
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      akte: {
        select: {
          id: true,
          anwaltId: true,
          sachbearbeiterId: true,
        },
      },
    },
  });

  if (!conversation) {
    return { allowed: false, isOwner: false, conversation: null };
  }

  // Owner always has access
  if (conversation.userId === userId) {
    return { allowed: true, isOwner: true, conversation };
  }

  // Shared access: conversations without Akte scope are shareable to all authenticated users
  if (!conversation.akteId) {
    return { allowed: true, isOwner: false, conversation };
  }

  // Shared access with Akte: user must be assigned to the Akte
  if (conversation.akte) {
    const hasAkteAccess =
      conversation.akte.anwaltId === userId ||
      conversation.akte.sachbearbeiterId === userId;
    return { allowed: hasAkteAccess, isOwner: false, conversation };
  }

  return { allowed: false, isOwner: false, conversation };
}

// ---------------------------------------------------------------------------
// GET — Full conversation with messages
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const { allowed, conversation } = await checkAccess(id, session.user.id);

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Kein Zugriff auf diese Unterhaltung" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      akteId: conversation.akteId,
      titel: conversation.titel,
      messages: conversation.messages,
      model: conversation.model,
      tokenCount: conversation.tokenCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      akte: conversation.akte
        ? {
            id: conversation.akte.id,
          }
        : null,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH — Update titel or append messages
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const { allowed, isOwner, conversation } = await checkAccess(
    id,
    session.user.id
  );

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed || !isOwner) {
    return NextResponse.json(
      { error: "Nur der Ersteller kann diese Unterhaltung bearbeiten" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data: any = {};

  if (body.titel !== undefined) {
    data.titel = body.titel;
  }

  if (body.messages !== undefined && Array.isArray(body.messages)) {
    const existingMsgs = (conversation.messages as any[]) ?? [];
    data.messages = [...existingMsgs, ...body.messages];
  }

  const updated = await prisma.aiConversation.update({
    where: { id },
    data,
  });

  return NextResponse.json({ conversation: updated });
}

// ---------------------------------------------------------------------------
// DELETE — Delete conversation
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const { allowed, isOwner, conversation } = await checkAccess(
    id,
    session.user.id
  );

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed || !isOwner) {
    return NextResponse.json(
      { error: "Nur der Ersteller kann diese Unterhaltung loeschen" },
      { status: 403 }
    );
  }

  await prisma.aiConversation.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
