import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/messaging/channel-service";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/channels/[id] -- channel detail with members
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  if (!channel) {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  // Access check: user must be a member, or ADMIN
  const isMember = channel.members.some((m) => m.userId === session.user.id);
  const isAdmin = session.user.role === "ADMIN";

  if (!isMember && !isAdmin) {
    // For AKTE channels, also validate via requireAkteAccess
    if (channel.typ === "AKTE" && channel.akteId) {
      const akteResult = await requireAkteAccess(channel.akteId);
      if (akteResult.error) {
        return NextResponse.json(
          { error: "Kanal nicht gefunden" },
          { status: 404 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Kanal nicht gefunden" },
        { status: 404 },
      );
    }
  }

  const members = channel.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    userName: m.user.name,
    userAvatarUrl: m.user.avatarUrl,
    joinedAt: m.joinedAt.toISOString(),
    lastReadAt: m.lastReadAt.toISOString(),
  }));

  return NextResponse.json({
    channel: {
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      beschreibung: channel.beschreibung,
      typ: channel.typ,
      akteId: channel.akteId,
      archived: channel.archived,
      erstelltVonId: channel.erstelltVonId,
      createdAt: channel.createdAt.toISOString(),
      messageCount: channel._count.messages,
      members,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/channels/[id] -- update channel name/description
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  beschreibung: z.string().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  // Only creator or ADMIN can update
  if (channel.erstelltVonId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  // Cannot update AKTE channels (name derives from Akte kurzrubrum)
  if (channel.typ === "AKTE") {
    return NextResponse.json(
      { error: "Akte-Kanaele koennen nicht manuell bearbeitet werden" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Eingabe", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
    data.slug = generateSlug(parsed.data.name);
  }
  if (parsed.data.beschreibung !== undefined) {
    data.beschreibung = parsed.data.beschreibung;
  }

  try {
    const updated = await prisma.channel.update({
      where: { id },
      data,
    });

    return NextResponse.json({ channel: updated });
  } catch (err: unknown) {
    // Handle slug collision (P2002 unique constraint on slug)
    if (
      typeof err === "object" && err !== null &&
      "code" in err && (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ein Kanal mit diesem Namen existiert bereits" },
        { status: 409 },
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/channels/[id] -- archive (soft-delete) channel
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { id } = await params;

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json(
      { error: "Kanal nicht gefunden" },
      { status: 404 },
    );
  }

  // Only creator or ADMIN can archive
  if (channel.erstelltVonId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  // Cannot archive AKTE channels (they live as long as the Akte)
  if (channel.typ === "AKTE") {
    return NextResponse.json(
      { error: "Akte-Kanaele koennen nicht archiviert werden" },
      { status: 400 },
    );
  }

  await prisma.channel.update({
    where: { id },
    data: { archived: true },
  });

  return NextResponse.json({ success: true });
}
