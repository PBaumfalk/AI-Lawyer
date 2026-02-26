import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { z } from "zod";

const noteSchema = z.object({
  akteId: z.string().min(1, "akteId ist erforderlich"),
  nachricht: z.string().min(1, "Nachricht ist erforderlich"),
  ticketId: z.string().optional(),
});

/**
 * POST /api/openclaw/notes
 *
 * Create a case note (Aktennotiz) from the AI agent.
 * Notes are stored as ChatNachricht entries marked as AI-generated.
 *
 * Scope: WRITE case notes only.
 */
export async function POST(req: NextRequest) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const body = await req.json();
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { akteId, nachricht, ticketId } = parsed.data;

  // Verify case exists
  const akte = await prisma.akte.findUnique({ where: { id: akteId } });
  if (!akte) {
    return Response.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  const note = await prisma.chatNachricht.create({
    data: {
      akteId,
      userId: null, // AI-generated
      nachricht: `[AI-Notiz]\n${nachricht}`,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: null,
      akteId,
      aktion: "AI_NOTIZ_ERSTELLT",
      details: {
        noteId: note.id,
        ticketId: ticketId ?? null,
        source: "openclaw",
      },
    },
  });

  return Response.json(
    {
      id: note.id,
      akteId,
      createdAt: note.createdAt,
    },
    { status: 201 }
  );
}
