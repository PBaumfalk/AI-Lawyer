import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/channels/[id]/members -- list channel members
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id: channelId } = await params;

  // Verify user is member or ADMIN
  const isMember = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.user.id } },
  });

  if (!isMember && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  const members = await prisma.channelMember.findMany({
    where: { channelId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.name,
      userAvatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt.toISOString(),
      lastReadAt: m.lastReadAt.toISOString(),
    })),
  });
}

// ---------------------------------------------------------------------------
// POST /api/channels/[id]/members -- join an ALLGEMEIN channel
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id: channelId } = await params;

  // Find the channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, typ: true, archived: true },
  });

  if (!channel) {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  if (channel.archived) {
    return NextResponse.json(
      { error: "Kanal ist archiviert" },
      { status: 400 },
    );
  }

  // Only ALLGEMEIN channels support manual join
  if (channel.typ !== "ALLGEMEIN") {
    return NextResponse.json(
      { error: "Akte-Kanaele werden automatisch verwaltet" },
      { status: 400 },
    );
  }

  try {
    const member = await prisma.channelMember.create({
      data: {
        channelId,
        userId: session.user.id,
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err: unknown) {
    // Handle duplicate membership (P2002 unique constraint)
    if (
      typeof err === "object" && err !== null &&
      "code" in err && (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Bereits Mitglied" },
        { status: 200 },
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/[id]/members -- leave an ALLGEMEIN channel
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id: channelId } = await params;

  // Find the channel to check typ
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, typ: true },
  });

  if (!channel) {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  // Only ALLGEMEIN channels support manual leave
  if (channel.typ !== "ALLGEMEIN") {
    return NextResponse.json(
      { error: "Akte-Kanaele werden automatisch verwaltet" },
      { status: 400 },
    );
  }

  const deleted = await prisma.channelMember.deleteMany({
    where: { channelId, userId: session.user.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Nicht Mitglied dieses Kanals" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
