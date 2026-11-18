import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { canAccessAkte } from "@/lib/rbac";
import { ticketAccessWhere } from "@/lib/tickets/access";
import { ticketEmailsInclude } from "@/lib/tickets/emails";
import { emailNachrichtZugriffWhere } from "@/lib/email/zugriff";

export async function GET(req: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const akteId = searchParams.get("akteId") ?? "";
  const tag = searchParams.get("tag") ?? "";

  const user = { id: result.session.user.id, role: result.session.user.role };
  const where: any = { AND: [ticketAccessWhere(user)] };
  if (status) where.status = status;
  if (akteId) where.akteId = akteId;
  if (tag) where.tags = { has: tag };

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { id: true, name: true } },
      ...ticketEmailsInclude,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(tickets);
}

export async function POST(req: NextRequest) {
  const postResult = await requireAuth();
  if (postResult.error) return postResult.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.titel !== "string" || !body.titel.trim()) {
    return Response.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }
  if (body.akteId) {
    const user = { id: postResult.session.user.id, role: postResult.session.user.role };
    if (!(await canAccessAkte(user, body.akteId))) {
      return Response.json({ error: "Akte nicht gefunden." }, { status: 404 });
    }
  }

  // Validate tags — ai: prefixed tags are system-managed
  const tags: string[] = (body.tags ?? []).map((t: string) => t.trim()).filter(Boolean);
  const hasAiTag = tags.some((t) => t.startsWith("ai:"));
  if (hasAiTag) {
    return Response.json(
      { error: "Tags mit dem Präfix 'ai:' können nicht manuell gesetzt werden." },
      { status: 400 }
    );
  }

  // Optional link to an email (current model EmailNachricht); the user must
  // have access to the email's mailbox and it must not have a ticket yet.
  const user = { id: postResult.session.user.id, role: postResult.session.user.role };
  if (body.emailId) {
    const email = await prisma.emailNachricht.findFirst({
      where: { AND: [{ id: String(body.emailId) }, emailNachrichtZugriffWhere(user)] },
      select: { id: true, ticketId: true },
    });
    if (!email) {
      return Response.json({ error: "E-Mail nicht gefunden." }, { status: 404 });
    }
    if (email.ticketId) {
      return Response.json({ error: "E-Mail hat bereits ein Ticket." }, { status: 409 });
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      titel: body.titel.trim(),
      beschreibung: body.beschreibung ?? null,
      akteId: body.akteId ?? null,
      status: "OFFEN",
      prioritaet: body.prioritaet ?? "NORMAL",
      faelligAm: body.faelligAm ? new Date(body.faelligAm) : null,
      verantwortlichId: body.verantwortlichId ?? null,
      tags,
      ...(body.emailId ? { emailNachrichten: { connect: { id: String(body.emailId) } } } : {}),
    },
  });

  return Response.json(ticket, { status: 201 });
}
