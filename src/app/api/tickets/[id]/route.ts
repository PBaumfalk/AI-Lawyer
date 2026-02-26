import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/tickets/[id] — get single ticket with relations
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
      emails: { select: { id: true, betreff: true, absender: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

/**
 * PATCH /api/tickets/[id] — update ticket fields
 *
 * Supports: titel, beschreibung, status, prioritaet, faelligAm,
 * verantwortlichId, akteId, tags
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden." }, { status: 404 });
  }

  const updateData: any = {};

  if (body.titel !== undefined) updateData.titel = body.titel;
  if (body.beschreibung !== undefined) updateData.beschreibung = body.beschreibung;
  if (body.prioritaet !== undefined) updateData.prioritaet = body.prioritaet;
  if (body.verantwortlichId !== undefined) updateData.verantwortlichId = body.verantwortlichId || null;
  if (body.akteId !== undefined) updateData.akteId = body.akteId || null;
  if (body.faelligAm !== undefined) {
    updateData.faelligAm = body.faelligAm ? new Date(body.faelligAm) : null;
  }

  // Tags update — ai: prefixed tags are system-managed and cannot be changed by users
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "Tags müssen ein Array sein." }, { status: 400 });
    }
    const userTags = body.tags.map((t: string) => t.trim()).filter(Boolean);
    const hasAiTag = userTags.some((t: string) => t.startsWith("ai:"));
    if (hasAiTag) {
      return NextResponse.json(
        { error: "Tags mit dem Präfix 'ai:' können nicht manuell gesetzt werden." },
        { status: 400 }
      );
    }
    // Preserve existing ai: tags, replace only user tags
    const existingAiTags = ticket.tags.filter((t) => t.startsWith("ai:"));
    updateData.tags = [...existingAiTags, ...userTags];
  }

  // Status transitions
  if (body.status !== undefined) {
    const validStatuses = ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Ungültiger Status '${body.status}'. Erlaubt: ${validStatuses.join(", ")}.` },
        { status: 400 }
      );
    }
    updateData.status = body.status;
    // Auto-set erledigtAm when completing, clear when reopening
    if (body.status === "ERLEDIGT") {
      updateData.erledigtAm = new Date();
    } else if (ticket.status === "ERLEDIGT") {
      updateData.erledigtAm = null;
    }
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
      emails: { select: { id: true, betreff: true } },
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/tickets/[id] — delete a ticket
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden." }, { status: 404 });
  }

  // Unlink any emails referencing this ticket
  await prisma.emailMessage.updateMany({
    where: { ticketId: id },
    data: { ticketId: null },
  });

  await prisma.ticket.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
