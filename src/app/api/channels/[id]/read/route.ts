import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/channels/[id]/read -- mark channel as read (update lastReadAt)
// ---------------------------------------------------------------------------

export async function PATCH(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id: channelId } = await params;

  const updated = await prisma.channelMember.updateMany({
    where: { channelId, userId: session.user.id },
    data: { lastReadAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Nicht Mitglied dieses Kanals" },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
