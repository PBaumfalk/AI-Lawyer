import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const akteId = searchParams.get("akteId") ?? "";
  const tag = searchParams.get("tag") ?? "";

  const where: any = {};
  if (status) where.status = status;
  if (akteId) where.akteId = akteId;
  if (tag) where.tags = { has: tag };

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
      emails: { select: { id: true, betreff: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(tickets);
}

export async function POST(req: NextRequest) {
  const postResult = await requireAuth();
  if (postResult.error) return postResult.error;

  const body = await req.json();

  // Validate tags — ai: prefixed tags are system-managed
  const tags: string[] = (body.tags ?? []).map((t: string) => t.trim()).filter(Boolean);
  const hasAiTag = tags.some((t) => t.startsWith("ai:"));
  if (hasAiTag) {
    return Response.json(
      { error: "Tags mit dem Präfix 'ai:' können nicht manuell gesetzt werden." },
      { status: 400 }
    );
  }

  const ticket = await prisma.ticket.create({
    data: {
      titel: body.titel,
      beschreibung: body.beschreibung ?? null,
      akteId: body.akteId ?? null,
      status: "OFFEN",
      prioritaet: body.prioritaet ?? "NORMAL",
      faelligAm: body.faelligAm ? new Date(body.faelligAm) : null,
      verantwortlichId: body.verantwortlichId ?? null,
      tags,
    },
  });

  // Link email to ticket if emailId provided
  if (body.emailId) {
    await prisma.emailMessage.update({
      where: { id: body.emailId },
      data: { ticketId: ticket.id },
    });
  }

  return Response.json(ticket, { status: 201 });
}
