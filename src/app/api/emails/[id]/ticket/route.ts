import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST /api/emails/[id]/ticket — Create a Ticket from an email.
 * Pre-fills title, description, Akte from email data.
 * Accepts optional overrides in request body.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch email with veraktung info
  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    select: {
      id: true,
      betreff: true,
      inhaltText: true,
      empfangenAm: true,
      gesendetAm: true,
      absender: true,
      absenderName: true,
      ticketId: true,
      veraktungen: {
        where: { aufgehoben: false },
        select: { akteId: true },
        take: 1,
      },
    },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Check if ticket already exists
  if (email.ticketId) {
    return Response.json(
      { error: "E-Mail hat bereits ein Ticket" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Pre-fill from email, allow overrides
  const dateStr = email.empfangenAm ?? email.gesendetAm;
  const dateLabel = dateStr
    ? new Date(dateStr).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "unbekannt";

  const defaultBeschreibung = `Aus E-Mail vom ${dateLabel}\n\n${
    email.inhaltText?.slice(0, 500) ?? ""
  }`;

  const titel = body.titel ?? email.betreff ?? "(Kein Betreff)";
  const beschreibung = body.beschreibung ?? defaultBeschreibung;
  const akteId =
    body.akteId ?? email.veraktungen[0]?.akteId ?? null;
  const prioritaet = body.prioritaet ?? "NORMAL";
  const faelligAm = body.faelligAm ? new Date(body.faelligAm) : null;
  const verantwortlichId = body.verantwortlichId ?? null;

  try {
    const ticket = await prisma.ticket.create({
      data: {
        titel,
        beschreibung,
        akteId,
        prioritaet,
        faelligAm,
        verantwortlichId,
      },
    });

    // Link ticket to email
    await prisma.emailNachricht.update({
      where: { id },
      data: { ticketId: ticket.id },
    });

    await logAuditEvent({
      userId: session.user.id,
      akteId,
      aktion: "EMAIL_TICKET_ERSTELLT",
      details: {
        emailNachrichtId: id,
        ticketId: ticket.id,
        titel,
      },
    });

    return Response.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Ticket creation error:", error);
    return Response.json(
      { error: "Fehler beim Erstellen des Tickets" },
      { status: 500 }
    );
  }
}
