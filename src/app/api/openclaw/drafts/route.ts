import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { z } from "zod";

const draftSchema = z.object({
  akteId: z.string().min(1, "akteId ist erforderlich"),
  name: z.string().min(1, "Dokumentname ist erforderlich"),
  inhalt: z.string().min(1, "Dokumentinhalt ist erforderlich"),
  tags: z.array(z.string()).default([]),
  ordner: z.string().optional(),
  ticketId: z.string().optional(),
});

/**
 * POST /api/openclaw/drafts
 *
 * Create a document draft (status: entwurf) for a case.
 * The draft is stored as plain text in the database.
 * AI agents may ONLY create drafts — never set status to freigegeben/versendet.
 *
 * Scope: WRITE drafts only (entwurf status).
 */
export async function POST(req: NextRequest) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const body = await req.json();
  const parsed = draftSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { akteId, name, inhalt, tags, ordner, ticketId } = parsed.data;

  // Verify the case exists
  const akte = await prisma.akte.findUnique({ where: { id: akteId } });
  if (!akte) {
    return Response.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  // If ticketId provided, verify it exists and has ai: tags
  if (ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || !ticket.tags.some((t) => t.startsWith("ai:"))) {
      return Response.json(
        { error: "Ticket nicht gefunden oder kein ai:-Tag" },
        { status: 404 }
      );
    }
  }

  // Create a ChatNachricht as an AI-generated draft/note
  // (Using ChatNachricht because Dokument requires a MinIO file path,
  //  and AI-generated text drafts are better stored as messages.)
  const draft = await prisma.chatNachricht.create({
    data: {
      akteId,
      userId: null, // AI-generated, no user
      nachricht: `[AI-Entwurf: ${name}]\n\n${inhalt}`,
      // Note: ChatNachricht doesn't have status/tags fields in current schema.
      // For full document draft workflow, the Dokument model will need
      // a status field (entwurf/zur_pruefung/freigegeben/versendet).
      // This is addressed in a separate fix_plan task.
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: null,
      akteId,
      aktion: "AI_ENTWURF_ERSTELLT",
      details: {
        draftId: draft.id,
        name,
        tags: ["ai:generated", ...tags],
        ticketId: ticketId ?? null,
        source: "openclaw",
      },
    },
  });

  return Response.json(
    {
      id: draft.id,
      akteId,
      name,
      status: "entwurf",
      createdAt: draft.createdAt,
    },
    { status: 201 }
  );
}
