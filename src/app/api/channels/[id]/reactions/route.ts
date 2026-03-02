import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getSocketEmitter } from "@/lib/socket/emitter";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const addReactionSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(8), // Emoji can be multi-codepoint
});

const removeReactionSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(8),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the user is a member of the channel (or ADMIN).
 */
async function verifyMembership(
  channelId: string,
  userId: string,
  userRole: string,
): Promise<NextResponse | null> {
  if (userRole === "ADMIN") return null;

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Du bist kein Mitglied dieses Kanals" },
      { status: 403 },
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/channels/{id}/reactions -- Add reaction
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id: channelId } = await params;

  // Verify membership
  const memberError = await verifyMembership(
    channelId,
    session.user.id,
    session.user.role,
  );
  if (memberError) return memberError;

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

  const parsed = addReactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { messageId, emoji } = parsed.data;

  // Verify message belongs to this channel and is not soft-deleted
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { channelId: true, deletedAt: true },
  });

  if (!message || message.channelId !== channelId) {
    return NextResponse.json(
      { error: "Nachricht nicht in diesem Kanal gefunden" },
      { status: 404 },
    );
  }

  if (message.deletedAt) {
    return NextResponse.json(
      { error: "Reaktion auf geloeschte Nachricht nicht moeglich" },
      { status: 400 },
    );
  }

  // Create reaction -- handle P2002 (duplicate) gracefully
  try {
    const reaction = await prisma.messageReaction.create({
      data: {
        messageId,
        userId: session.user.id,
        emoji,
      },
    });

    // Emit reaction update to channel room
    getSocketEmitter()
      .to(`channel:${channelId}`)
      .emit("reaction:added", {
        messageId,
        emoji,
        userId: session.user.id,
        userName: session.user.name,
      });

    return NextResponse.json({ reaction }, { status: 201 });
  } catch (err: unknown) {
    // P2002: Unique constraint violation (same user, same emoji, same message)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Reaktion bereits vorhanden" },
        { status: 200 },
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/{id}/reactions -- Remove reaction
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id: channelId } = await params;

  // Parse body for messageId + emoji
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 },
    );
  }

  const parsed = removeReactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { messageId, emoji } = parsed.data;

  // Delete reaction by unique constraint fields
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: session.user.id,
        emoji,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Reaktion nicht gefunden" },
      { status: 404 },
    );
  }

  await prisma.messageReaction.delete({
    where: { id: existing.id },
  });

  // Emit reaction removal to channel room
  getSocketEmitter()
    .to(`channel:${channelId}`)
    .emit("reaction:removed", {
      messageId,
      emoji,
      userId: session.user.id,
    });

  return NextResponse.json({ success: true });
}
