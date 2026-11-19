import type { UserRole } from "@prisma/client";
/**
 * GET/PATCH/DELETE /api/ki-chat/conversations/[id]
 *
 * Single conversation operations.
 * GET: Return full conversation with messages (RBAC: owner or Akte access).
 * PATCH: Update titel or append messages.
 * DELETE: Delete conversation.
 */

import { NextRequest, NextResponse } from "next/server";
import { canAccessAkte } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Auth helper — owner check + Akte RBAC for shared conversations
// ---------------------------------------------------------------------------

async function checkAccess(
  conversationId: string,
  user: { id: string; role: UserRole }
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

  const userId = user.id;
  // Owner always has access
  if (conversation.userId === userId) {
    return { allowed: true, isOwner: true, conversation };
  }

  // Shared access: conversations without Akte scope are shareable to all authenticated users
  if (!conversation.akteId) {
    return { allowed: true, isOwner: false, conversation };
  }

  // Shared access with Akte: same rules as the Akte itself
  // (assignment, Dezernat, admin) instead of a partial copy of them.
  if (conversation.akte) {
    const hasAkteAccess = await canAccessAkte(user, conversation.akteId);
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
  const { allowed, conversation } = await checkAccess(id, { id: session.user.id!, role: (session.user as any).role });

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed) {
    // Same answer as for a missing conversation: do not reveal existence.
    return NextResponse.json({ error: "Unterhaltung nicht gefunden" }, { status: 404 });
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
  const { allowed, isOwner, conversation } = await checkAccess(id, { id: session.user.id!, role: (session.user as any).role });

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed) {
    // Same answer as for a missing conversation: do not reveal existence.
    return NextResponse.json({ error: "Unterhaltung nicht gefunden" }, { status: 404 });
  }
  if (!isOwner) {
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
  const { allowed, isOwner, conversation } = await checkAccess(id, { id: session.user.id!, role: (session.user as any).role });

  if (!conversation) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (!allowed) {
    // Same answer as for a missing conversation: do not reveal existence.
    return NextResponse.json({ error: "Unterhaltung nicht gefunden" }, { status: 404 });
  }
  if (!isOwner) {
    return NextResponse.json(
      { error: "Nur der Ersteller kann diese Unterhaltung löschen" },
      { status: 403 }
    );
  }

  await prisma.aiConversation.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
