import { NextRequest, NextResponse } from "next/server";
import { requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { gatherAkteMemberIds, syncAkteChannelMembers } from "@/lib/messaging/channel-service";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/akten/[id]/channel -- lazy-create AKTE channel with RBAC members
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id: akteId } = await params;

  // Gate access via standard RBAC
  const result = await requireAkteAccess(akteId);
  if (result.error) return result.error;
  const { session } = result;

  // Check for existing channel
  let channel = await prisma.channel.findUnique({
    where: { akteId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (channel) {
    // Sync members in the background to ensure RBAC consistency
    await syncAkteChannelMembers(channel.id, akteId);

    // Refetch to include newly synced members
    channel = await prisma.channel.findUnique({
      where: { akteId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({
      channel: formatChannelResponse(channel!),
    });
  }

  // No channel exists yet -- lazy-create in a transaction
  // Fetch kurzrubrum separately (requireAkteAccess only selects id, anwaltId, sachbearbeiterId, kanzleiId)
  const akteInfo = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { kurzrubrum: true },
  });

  const channelName = `Akte: ${akteInfo?.kurzrubrum || akteId}`;
  const channelSlug = `akte-${akteId}`;

  try {
    const newChannel = await prisma.$transaction(async (tx) => {
      const ch = await tx.channel.create({
        data: {
          name: channelName,
          slug: channelSlug,
          typ: "AKTE",
          akteId,
          erstelltVonId: session.user.id,
        },
      });

      // Gather RBAC-based member IDs and create memberships
      const memberIds = await gatherAkteMemberIds(tx, akteId);
      if (memberIds.length > 0) {
        await tx.channelMember.createMany({
          data: memberIds.map((userId) => ({
            channelId: ch.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      return ch;
    });

    // Fetch the full channel with members
    const fullChannel = await prisma.channel.findUnique({
      where: { id: newChannel.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({
      channel: formatChannelResponse(fullChannel!),
    });
  } catch (err: unknown) {
    // Race condition: another request created the channel concurrently (P2002 on akteId unique)
    if (
      typeof err === "object" && err !== null &&
      "code" in err && (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.channel.findUnique({
        where: { akteId },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      });

      if (existing) {
        return NextResponse.json({
          channel: formatChannelResponse(existing),
        });
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helper: format channel response with member details
// ---------------------------------------------------------------------------

function formatChannelResponse(channel: {
  id: string;
  name: string;
  slug: string;
  beschreibung: string | null;
  typ: string;
  akteId: string | null;
  archived: boolean;
  erstelltVonId: string;
  createdAt: Date;
  members: Array<{
    id: string;
    userId: string;
    joinedAt: Date;
    lastReadAt: Date;
    user: { id: string; name: string | null; avatarUrl: string | null };
  }>;
}) {
  return {
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    beschreibung: channel.beschreibung,
    typ: channel.typ,
    akteId: channel.akteId,
    archived: channel.archived,
    erstelltVonId: channel.erstelltVonId,
    createdAt: channel.createdAt.toISOString(),
    members: channel.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.name,
      userAvatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt.toISOString(),
      lastReadAt: m.lastReadAt.toISOString(),
    })),
  };
}
