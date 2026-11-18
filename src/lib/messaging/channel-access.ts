import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";

/**
 * Whether access to a channel is decided by access to its Akte rather than by
 * ChannelMember rows: AKTE channels for everybody, PORTAL channels for staff.
 *
 * PORTAL channels are created with only the Mandant and the responsible
 * Anwalt as members, so a Sachbearbeiter or a Dezernat colleague who works on
 * the Akte got 403. Staff access follows the Akte; the Mandant still needs
 * membership (his own channel only).
 */
export function accessViaAkte(channel: { typ: string; akteId: string | null }, role: string): boolean {
  if (!channel.akteId) return false;
  if (channel.typ === "AKTE") return true;
  return channel.typ === "PORTAL" && role !== "MANDANT";
}

/**
 * Shared channel gate for /api/channels/[id]/* routes.
 * Akte-bound channels → requireAkteAccess; otherwise membership (or ADMIN).
 */
export async function verifyChannelAccess(
  channelId: string,
  userId: string,
  userRole: string,
): Promise<
  | { channel: { id: string; typ: string; akteId: string | null }; error?: undefined }
  | { channel?: undefined; error: NextResponse }
> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, typ: true, akteId: true },
  });

  if (!channel) {
    return { error: NextResponse.json({ error: "Kanal nicht gefunden" }, { status: 404 }) };
  }

  if (accessViaAkte(channel, userRole)) {
    const akteResult = await requireAkteAccess(channel.akteId!);
    if (akteResult.error) return { error: akteResult.error };
    return { channel };
  }

  if (userRole === "ADMIN") return { channel };

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  });
  if (!membership) {
    return {
      error: NextResponse.json({ error: "Du bist kein Mitglied dieses Kanals" }, { status: 403 }),
    };
  }
  return { channel };
}
