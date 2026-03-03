import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createChannel, getUnreadCount } from "@/lib/messaging/channel-service";
import type { ChannelListItem } from "@/lib/messaging/types";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/channels -- list channels the user is a member of (or browse mode)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const typFilter = searchParams.get("typ");
  const browse = searchParams.get("browse") === "true";

  if (browse) {
    // Browse mode: list ALL non-archived ALLGEMEIN channels (for joining)
    const allChannels = await prisma.channel.findMany({
      where: {
        typ: "ALLGEMEIN",
        archived: false,
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const channels = allChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      slug: ch.slug,
      beschreibung: ch.beschreibung,
      typ: ch.typ,
      akteId: ch.akteId,
      archived: ch.archived,
      memberCount: ch._count.members,
      joined: ch.members.length > 0,
    }));

    return NextResponse.json({ channels });
  }

  // Normal mode: list channels the user is a member of
  const memberships = await prisma.channelMember.findMany({
    where: { userId },
    include: {
      channel: {
        include: {
          _count: { select: { members: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          mandantUser: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Filter by typ if provided
  let filtered = memberships;
  if (typFilter === "ALLGEMEIN" || typFilter === "AKTE" || typFilter === "PORTAL") {
    filtered = memberships.filter((m) => m.channel.typ === typFilter);
  }

  // Build response with unread counts
  const channels: ChannelListItem[] = await Promise.all(
    filtered.map(async (m) => {
      const ch = m.channel;
      const unreadCount = await getUnreadCount(ch.id, userId);
      const lastMsg = ch.messages[0];

      return {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        beschreibung: ch.beschreibung,
        typ: ch.typ,
        akteId: ch.akteId,
        archived: ch.archived,
        memberCount: ch._count.members,
        unreadCount,
        lastMessageAt: lastMsg ? lastMsg.createdAt.toISOString() : null,
        mandantUserId: ch.mandantUser?.id ?? null,
        mandantUserName: ch.mandantUser?.name ?? null,
      };
    })
  );

  // Sort by lastMessageAt desc (most recently active first), then by name
  channels.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    }
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ channels });
}

// ---------------------------------------------------------------------------
// POST /api/channels -- create a new ALLGEMEIN channel
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  beschreibung: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Eingabe", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { name, beschreibung } = parsed.data;

  const res = await createChannel({
    name,
    beschreibung,
    erstelltVonId: session.user.id,
  });

  if (res.error) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 409 },
    );
  }

  return NextResponse.json({ channel: res.channel }, { status: 201 });
}
