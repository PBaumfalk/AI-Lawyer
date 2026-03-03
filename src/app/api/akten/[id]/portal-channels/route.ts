import { NextRequest, NextResponse } from "next/server";
import { requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getUnreadCount } from "@/lib/messaging/channel-service";
import type { ChannelListItem } from "@/lib/messaging/types";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/akten/[id]/portal-channels -- list PORTAL channels for an Akte
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id: akteId } = await params;

  // Gate access via standard internal RBAC
  const result = await requireAkteAccess(akteId);
  if (result.error) return result.error;
  const { session } = result;

  const portalChannels = await prisma.channel.findMany({
    where: { akteId, typ: "PORTAL" },
    include: {
      _count: { select: { members: true } },
      mandantUser: {
        select: { id: true, name: true },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const channels: ChannelListItem[] = await Promise.all(
    portalChannels.map(async (ch) => {
      const unreadCount = await getUnreadCount(ch.id, session.user.id);
      const lastMsg = ch.messages[0];

      return {
        id: ch.id,
        name: ch.name,
        slug: ch.slug,
        beschreibung: ch.beschreibung,
        typ: ch.typ as "PORTAL",
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

  return NextResponse.json({ channels });
}
