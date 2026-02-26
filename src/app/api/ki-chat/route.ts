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

const NO_SOURCES_INSTRUCTION = `\n\nHinweis fuer diese Antwort: Es wurden keine passenden Dokumente in den Akten gefunden. Antworte trotzdem mit deinem allgemeinen juristischen Wissen und weise kurz darauf hin, dass kein Akten-Kontext verfuegbar ist.`;

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

  let systemPrompt = SYSTEM_PROMPT_BASE;

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
