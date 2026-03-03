import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { createPortalChannel } from "@/lib/messaging/channel-service";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/portal/akten/[id]/channel -- lazy-create PORTAL channel for Mandant+Akte
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { id: akteId } = await params;

  // Auth: require MANDANT role
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  // Verify Mandant access to this Akte
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  // Check for existing PORTAL channel
  let channel = await prisma.channel.findFirst({
    where: { akteId, typ: "PORTAL", mandantUserId: session.user.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (channel) {
    return NextResponse.json({ channel: formatPortalChannel(channel) });
  }

  // Lazy-create: fetch Akte info to get anwaltId and kurzrubrum
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { anwaltId: true, kurzrubrum: true },
  });

  if (!akte?.anwaltId) {
    return NextResponse.json(
      { error: "Akte hat keinen zustaendigen Anwalt" },
      { status: 400 }
    );
  }

  const result = await createPortalChannel({
    akteId,
    mandantUserId: session.user.id,
    mandantName: session.user.name || "Mandant",
    anwaltUserId: akte.anwaltId,
    akteKurzrubrum: akte.kurzrubrum,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 }
    );
  }

  // Fetch the full channel with members
  const fullChannel = await prisma.channel.findUnique({
    where: { id: result.channel!.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({
    channel: formatPortalChannel(fullChannel!),
  });
}

// ---------------------------------------------------------------------------
// Helper: format portal channel response
// ---------------------------------------------------------------------------

function formatPortalChannel(channel: {
  id: string;
  name: string;
  slug: string;
  typ: string;
  akteId: string | null;
  mandantUserId: string | null;
  archived: boolean;
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
    typ: channel.typ,
    akteId: channel.akteId,
    mandantUserId: channel.mandantUserId,
    archived: channel.archived,
    createdAt: channel.createdAt.toISOString(),
    members: channel.members.map((m) => ({
      userId: m.user.id,
      userName: m.user.name,
      userAvatarUrl: m.user.avatarUrl,
    })),
  };
}
