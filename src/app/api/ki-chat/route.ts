/**
 * POST /api/ki-chat
 *
 * Streaming RAG chat endpoint.
 * Retrieves relevant document chunks via pgvector, builds a system prompt
 * with source citations, and streams the AI response using the AI SDK.
 *
 * === Helena HARD LIMITS ===
 * All AI output is ENTWURF by default and requires human Freigabe.
 * Helena may NEVER send external communications, delete data, etc.
 * ===========================
 */

import { NextRequest } from "next/server";
import { streamText, type CoreMessage } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getModel, getModelName, getProviderName } from "@/lib/ai/provider";
import { trackTokenUsage } from "@/lib/ai/token-tracker";
import { generateQueryEmbedding } from "@/lib/embedding/embedder";
import { searchSimilar, type SearchResult } from "@/lib/embedding/vector-store";

// ---------------------------------------------------------------------------
// System prompt for Helena (German)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_BASE = `Du bist Helena, eine digitale Rechtsanwaltsfachangestellte. Du antwortest immer auf Deutsch.
Nutze dein juristisches Fachwissen, um dem Nutzer hilfreich zu antworten.
Wenn Akten-Dokumente als Quellen bereitgestellt werden, beziehe dich konkret auf sie und zitiere sie als nummerierte Referenzen [1], [2] etc.
Erfinde KEINE konkreten Falldetails, Namen, Daten oder Fakten, die nicht in den bereitgestellten Quellen stehen — allgemeines juristisches Wissen darfst du immer einbringen.
Beende deine Antwort mit: "Hinweis: Dieser Assistent ersetzt keine anwaltliche Pruefung."`;

const NO_SOURCES_INSTRUCTION = `\n\nHinweis fuer diese Antwort: Die semantische Suche hat keine passenden Dokument-Passagen gefunden. Falls im AKTEN-KONTEXT Dokumente mit Textauszuegen aufgelistet sind, nutze diese Informationen. Ansonsten antworte mit deinem allgemeinen juristischen Wissen und weise kurz darauf hin, dass keine detaillierten Dokumentinhalte verfuegbar sind.`;

const LOW_CONFIDENCE_INSTRUCTION = `\n\nHinweis fuer diese Antwort: Die gefundenen Dokumente haben nur geringe Relevanz zur Frage. Antworte primaer mit deinem Fachwissen und erwaehne die vorhandenen Dokumente nur wenn sie wirklich relevant sind.`;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Nicht authentifiziert", { status: 401 });
  }

  const userId = session.user.id;

  const body = await req.json();
  const {
    messages,
    akteId,
    conversationId,
    crossAkte = false,
  } = body as {
    messages: CoreMessage[];
    akteId?: string | null;
    conversationId?: string | null;
    crossAkte?: boolean;
  };

  if (!messages || messages.length === 0) {
    return new Response("Keine Nachrichten", { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Fetch structured Akte data for context (when akteId is provided)
  // ---------------------------------------------------------------------------

  let aktenKontextBlock = "";

  if (akteId) {
    try {
      const akte = await prisma.akte.findUnique({
        where: { id: akteId },
        include: {
          beteiligte: { include: { kontakt: true } },
          dokumente: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              name: true,
              mimeType: true,
              ocrStatus: true,
              ordner: true,
              tags: true,
              createdAt: true,
            },
          },
          kalenderEintraege: {
            where: { erledigt: false, datum: { gte: new Date() } },
            orderBy: { datum: "asc" },
            take: 10,
          },
        },
      });

      if (akte) {
        const formatBeteiligter = (b: {
          rolle: string;
          kontakt: {
            vorname?: string | null;
            nachname?: string | null;
            firma?: string | null;
          };
        }) => {
          const name =
            b.kontakt.firma ??
            [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ") ??
            "Unbekannt";
          return `- ${name} (${b.rolle})`;
        };

        const beteiligteLines =
          akte.beteiligte.length > 0
            ? akte.beteiligte.map(formatBeteiligter).join("\n")
            : "- (keine Beteiligten erfasst)";

        const formatDate = (d: Date) => d.toISOString().slice(0, 10);

        const terminLines =
          akte.kalenderEintraege.length > 0
            ? akte.kalenderEintraege
                .map((e) => {
                  const flags = [e.typ, e.istNotfrist ? "NOTFRIST" : null]
                    .filter(Boolean)
                    .join(", ");
                  return `- ${formatDate(e.datum)}: ${e.titel} (${flags})`;
                })
                .join("\n")
            : "- (keine anstehenden Fristen/Termine)";

        // Load OCR text snippets separately — only for completed docs, truncated in DB
        // Uses raw SQL to avoid loading full ocrText blobs into memory
        const ocrDocIds = akte.dokumente
          .filter((d) => d.ocrStatus === "ABGESCHLOSSEN")
          .slice(0, 5)
          .map((d) => d.id);

        const ocrSnippets = new Map<string, string>();
        if (ocrDocIds.length > 0) {
          const snippetRows = await prisma.$queryRaw<
            { id: string; snippet: string }[]
          >`SELECT id, LEFT("ocrText", 500) as snippet FROM "Dokument" WHERE id = ANY(${ocrDocIds}) AND "ocrText" IS NOT NULL`;
          for (const row of snippetRows) {
            if (row.snippet) ocrSnippets.set(row.id, row.snippet.trim());
          }
        }

        // Build document listing
        const dokumenteLines =
          akte.dokumente.length > 0
            ? akte.dokumente
                .map((d) => {
                  const ocrLabel =
                    d.ocrStatus === "ABGESCHLOSSEN"
                      ? "OCR OK"
                      : d.ocrStatus === "IN_BEARBEITUNG"
                        ? "OCR laeuft"
                        : d.ocrStatus === "FEHLGESCHLAGEN"
                          ? "OCR fehlgeschlagen"
                          : "OCR ausstehend";
                  const folder = d.ordner ? ` [${d.ordner}]` : "";
                  const tagStr = d.tags.length > 0 ? ` Tags: ${d.tags.join(", ")}` : "";
                  let line = `- ${d.name} (${d.mimeType}, ${ocrLabel})${folder}${tagStr}`;

                  const snippet = ocrSnippets.get(d.id);
                  if (snippet) {
                    line += `\n  Textauszug: ${snippet} [...]`;
                  }

                  return line;
                })
                .join("\n")
            : "- (keine Dokumente vorhanden)";

        aktenKontextBlock = `\n\n--- AKTEN-KONTEXT ---
Aktenzeichen: ${akte.aktenzeichen}
Rubrum: ${akte.kurzrubrum}
Wegen: ${akte.wegen ?? "—"}
Sachgebiet: ${akte.sachgebiet}
Status: ${akte.status}

Beteiligte:
${beteiligteLines}

Dokumente in dieser Akte (${akte.dokumente.length}):
${dokumenteLines}

Anstehende Fristen/Termine (naechste 10):
${terminLines}
--- ENDE AKTEN-KONTEXT ---`;
      }
    } catch (err) {
      // Non-fatal — continue without structured context
      console.error("[ki-chat] Akte context fetch failed:", err);
    }
  }

  // Get the last user message for RAG retrieval
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) {
    return new Response("Keine Benutzer-Nachricht", { status: 400 });
  }

  const queryText =
    typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";

  // ---------------------------------------------------------------------------
  // RAG retrieval
  // ---------------------------------------------------------------------------

  let sources: SearchResult[] = [];
  let confidenceFlag: "none" | "low" | "ok" = "none";

  try {
    // Generate query embedding with "query: " prefix per E5 format
    const queryEmbedding = await generateQueryEmbedding(queryText);

    sources = await searchSimilar(queryEmbedding, {
      akteId: akteId ?? undefined,
      crossAkte,
      userId,
      limit: 10,
    });

    if (sources.length === 0) {
      confidenceFlag = "none";
    } else {
      const maxScore = Math.max(...sources.map((s) => s.score));
      confidenceFlag = maxScore < 0.3 ? "low" : "ok";
    }
  } catch (err) {
    // Embedding service might be unavailable -- continue without sources
    console.error("[ki-chat] RAG retrieval failed:", err);
    confidenceFlag = "none";
  }

  // ---------------------------------------------------------------------------
  // Build system prompt with sources
  // ---------------------------------------------------------------------------

  let systemPrompt = SYSTEM_PROMPT_BASE + aktenKontextBlock;

  if (confidenceFlag === "none") {
    systemPrompt += NO_SOURCES_INSTRUCTION;
  } else if (confidenceFlag === "low") {
    systemPrompt += LOW_CONFIDENCE_INSTRUCTION;
  }

  if (sources.length > 0) {
    systemPrompt += "\n\n--- QUELLEN ---\n";
    sources.forEach((src, i) => {
      systemPrompt += `\n[${i + 1}] Dokument: ${src.dokumentName} (Akte: ${src.akteAktenzeichen})\n${src.content}\n`;
    });
    systemPrompt += "\n--- ENDE QUELLEN ---";
  }

  // ---------------------------------------------------------------------------
  // Stream the AI response
  // ---------------------------------------------------------------------------

  const model = await getModel();
  const modelName = await getModelName();
  const providerName = await getProviderName();

  // Build sources metadata for client-side display
  const sourcesData = sources.map((src, i) => ({
    index: i + 1,
    dokumentId: src.dokumentId,
    name: src.dokumentName,
    akteAktenzeichen: src.akteAktenzeichen,
    passage: src.content.slice(0, 200),
    score: src.score,
  }));

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    onFinish: async ({ text, usage }) => {
      const tokensIn = usage?.promptTokens ?? 0;
      const tokensOut = usage?.completionTokens ?? 0;

      // Track token usage
      if (tokensIn > 0 || tokensOut > 0) {
        try {
          await trackTokenUsage({
            userId,
            akteId: akteId ?? undefined,
            funktion: "CHAT",
            provider: providerName,
            model: modelName,
            tokensIn,
            tokensOut,
          });
        } catch (err) {
          console.error("[ki-chat] Token tracking failed:", err);
        }
      }

      // Save/update conversation
      try {
        const assistantText = text ?? "";
        const now = new Date().toISOString();

        if (conversationId) {
          // Append messages to existing conversation
          const existing = await prisma.aiConversation.findUnique({
            where: { id: conversationId },
          });

          if (existing && existing.userId === userId) {
            const existingMsgs = (existing.messages as any[]) ?? [];
            const newMsgs = [
              ...existingMsgs,
              { role: "user", content: queryText, timestamp: now },
              {
                role: "assistant",
                content: assistantText,
                timestamp: now,
                sources: sourcesData,
              },
            ];

            await prisma.aiConversation.update({
              where: { id: conversationId },
              data: {
                messages: newMsgs,
                tokenCount: { increment: tokensIn + tokensOut },
              },
            });
          }
        } else {
          // Create new conversation
          const titel =
            queryText.length > 50
              ? queryText.slice(0, 47) + "..."
              : queryText;

          await prisma.aiConversation.create({
            data: {
              ...(akteId ? { akte: { connect: { id: akteId } } } : {}),
              user: { connect: { id: userId } },
              titel,
              messages: [
                { role: "user", content: queryText, timestamp: now },
                {
                  role: "assistant",
                  content: assistantText,
                  timestamp: now,
                  sources: sourcesData,
                },
              ],
              model: modelName,
              tokenCount: (tokensIn || 0) + (tokensOut || 0),
            },
          });
        }
      } catch (err) {
        console.error("[ki-chat] Conversation save failed:", err);
      }
    },
  });

  return result.toDataStreamResponse({
    headers: {
      "X-Sources": encodeURIComponent(JSON.stringify(sourcesData)),
    },
  });
}
