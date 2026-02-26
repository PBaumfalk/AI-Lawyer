import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";

/**
 * GET /api/openclaw/akten/[id]/context
 *
 * Read case context for AI processing (RAG).
 * Returns case metadata, parties, document summaries, and recent notes.
 * Does NOT return full document content (use separate document endpoints).
 *
 * Scope: READ case context for ai:-tagged task processing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const { id } = await params;

  const akte = await prisma.akte.findUnique({
    where: { id },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      wegen: true,
      sachgebiet: true,
      status: true,
      gegenstandswert: true,
      notizen: true,
      angelegt: true,
      anwalt: { select: { id: true, name: true } },
      sachbearbeiter: { select: { id: true, name: true } },
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
              email: true,
            },
          },
        },
      },
      dokumente: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          tags: true,
          ordner: true,
          createdAt: true,
          // ocrText intentionally excluded — too large for overview.
          // Use a dedicated document endpoint for full text.
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      kalenderEintraege: {
        select: {
          id: true,
          typ: true,
          titel: true,
          datum: true,
          erledigt: true,
          fristablauf: true,
        },
        where: { erledigt: false },
        orderBy: { datum: "asc" },
        take: 20,
      },
    },
  });

  if (!akte) {
    return Response.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  return Response.json(akte);
}
