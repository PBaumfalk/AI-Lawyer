import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";

/**
 * GET /api/openclaw/tasks/[id]
 *
 * Read a single ai:-tagged task with its case context.
 * Scope: READ only ai:-tagged tasks.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      akte: {
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          wegen: true,
          sachgebiet: true,
          status: true,
          notizen: true,
          beteiligte: {
            select: {
              id: true,
              rolle: true,
              kontakt: {
                select: {
                  id: true,
                  typ: true,
                  nachname: true,
                  vorname: true,
                  firma: true,
                },
              },
            },
          },
        },
      },
      verantwortlich: { select: { id: true, name: true } },
      emails: {
        select: { id: true, betreff: true, absender: true, empfangenAm: true },
      },
    },
  });

  if (!ticket) {
    return Response.json({ error: "Task nicht gefunden" }, { status: 404 });
  }

  // Verify task has ai: tags
  if (!ticket.tags.some((tag) => tag.startsWith("ai:"))) {
    return Response.json(
      { error: "Zugriff verweigert: Task hat keinen ai:-Tag" },
      { status: 403 }
    );
  }

  return Response.json(ticket);
}

/**
 * PATCH /api/openclaw/tasks/[id]
 *
 * Update an ai:-tagged task. Restricted operations:
 * - Add tags (only ai:* prefixed tags)
 * - Update status to ERLEDIGT or IN_BEARBEITUNG
 * - Update beschreibung (append notes)
 *
 * Scope: WRITE limited fields on ai:-tagged tasks only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return Response.json({ error: "Task nicht gefunden" }, { status: 404 });
  }

  // Verify task has ai: tags
  if (!ticket.tags.some((tag) => tag.startsWith("ai:"))) {
    return Response.json(
      { error: "Zugriff verweigert: Task hat keinen ai:-Tag" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const updateData: any = {};

  // Allow status changes: only ERLEDIGT or IN_BEARBEITUNG
  if (body.status) {
    const allowedStatuses = ["ERLEDIGT", "IN_BEARBEITUNG"];
    if (!allowedStatuses.includes(body.status)) {
      return Response.json(
        {
          error: `Status-Änderung nicht erlaubt. Erlaubt: ${allowedStatuses.join(", ")}`,
        },
        { status: 403 }
      );
    }
    updateData.status = body.status;
    if (body.status === "ERLEDIGT") {
      updateData.erledigtAm = new Date();
    } else if (ticket.status === "ERLEDIGT") {
      updateData.erledigtAm = null;
    }
  }

  // Allow adding ai: tags (never removing existing tags)
  if (body.addTags && Array.isArray(body.addTags)) {
    const validTags = body.addTags.filter(
      (t: string) => typeof t === "string" && t.startsWith("ai:")
    );
    if (validTags.length > 0) {
      updateData.tags = Array.from(new Set([...ticket.tags, ...validTags]));
    }
  }

  // Allow appending to description
  if (body.appendBeschreibung && typeof body.appendBeschreibung === "string") {
    const timestamp = new Date().toISOString();
    const existing = ticket.beschreibung ?? "";
    const separator = existing ? "\n\n---\n" : "";
    updateData.beschreibung = `${existing}${separator}[AI Agent ${timestamp}]\n${body.appendBeschreibung}`;
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json(
      { error: "Keine gültigen Änderungen" },
      { status: 400 }
    );
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: updateData,
  });

  // Audit log for AI actions
  await prisma.auditLog.create({
    data: {
      userId: null, // AI agent, no user
      akteId: ticket.akteId,
      aktion: "AI_TASK_AKTUALISIERT",
      details: {
        ticketId: id,
        changes: updateData,
        source: "openclaw",
      },
    },
  });

  return Response.json(updated);
}
