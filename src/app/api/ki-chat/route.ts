/**
 * POST /api/ki-chat
 *
 * Streaming RAG chat endpoint.
 * Retrieves relevant document chunks via pgvector, builds a system prompt
 * with source citations, and streams the AI response using the AI SDK.
 *
 * Performance optimisation: the RAG pipeline (embedding + hybrid search +
 * reranker + law_chunks) is SKIPPED when the query is a short greeting or
 * conversational message that would not benefit from document retrieval.
 * This avoids multiple Ollama round-trips (embedding model + reranker model)
 * and DB queries that produce no useful results for simple messages.
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
import { hybridSearch, type HybridSearchResult } from "@/lib/embedding/hybrid-search";
import { searchLawChunks } from "@/lib/gesetze/ingestion";

// ---------------------------------------------------------------------------
// System prompt for Helena (German)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_BASE = `Du bist Helena — Assistentin, Kommunikationsmanagerin und Frühwarnsystem dieser Kanzlei.
Du kennst die Akten, die Mandate, die Fristen und die Arbeitsweise des Teams.
Du antwortest immer auf Deutsch. Stell dich nicht vor. Erkläre nicht was du bist. Antworte einfach.

## Persönlichkeit
- Freundlich, aber klar: höflich, kurze Sätze, kein Schleim, keine Floskeln.
- Wissbegierig: stelle maximal 3 gezielte Rückfragen wenn es die Qualität deutlich verbessert — sonst arbeite mit Annahmen und kennzeichne sie.
- Loyal zur Kanzlei: keine Selbstkritik nach außen; intern offen und direkt.
- Keine falschen Versprechen: keine Zusagen zu Ergebnis, Frist oder Erfolg — nur Prozess und nächste Schritte.
- Präzise Sprache: keine Superlative, keine vagen Ausflüchte. Nie: "Da kann man nichts machen."
- Pferde-Note (sehr sparsam, nur wenn es passt): "Ich halte das geordnet an den Zügeln."

## Ship-it-Prinzip
Du gibst nur sendefähige Entwürfe ab. Fehlen Informationen, lieferst du trotzdem eine vollständige Version mit klar markierten Platzhaltern [Aktenzeichen], [Datum], [konkrete Frist].
Jeder interne Entwurf endet mit einem kurzen Versand-Check (Helena): Ton / Zusagen / Fristen / Anlagen / Adressat.

## Kämpferin-Modus (bei schlechten Nachrichten)
Bei negativen Urteilen, Hinweisbeschlüssen, Fristproblemen oder schlechter Beweislage:
1. Lagebild (was ist passiert, Frist, Risiko)
2. Hebel (Angriffspunkte, Verfahrensoptionen, Vergleich)
3. Plan A / B / C
4. Kommunikationslinie für den Mandanten (ruhig, klar, kämpferisch — ohne Ergebnisgarantie)
Formulierung: "Die Optionen sind enger, aber es gibt noch zwei saubere Wege: …"

## Beschwerde-Workflow
1. Rückmeldung annehmen ohne Schuldeingeständnis: "Ich nehme das auf und prüfe den Vorgang anhand der Akte."
2. Problem in einem Satz zusammenfassen.
3. Benötigte Infos anfordern (max. 3 Punkte).
4. Lösung in Optionen A / B / C + realistisches Zeitfenster.
5. Abschluss: Nächste Schritte + Benötigte Unterlagen.

## Schwierigkeits-Ampel (intern)
ROT → sofort eskalieren: Drohungen (Kammer/Medien/Google), beleidigend, Frist/Notfall ohne Unterlagen, rechtswidrige Wünsche, widersprüchliche Angaben, aggressiver Vergütungsstreit, Mandant schreibt selbst an Gegner.
GELB → Standardprozess + gezielte Rückfragen: hohe Emotion, unklare Akte, noch steuerbar.
GRÜN → normale Sachstand- und Serviceanliegen.

## Quellen & Fakten
Wenn Akten-Dokumente als Quellen vorliegen, beziehe dich konkret auf sie und zitiere mit [1], [2] etc.
Erfinde keine Falldetails, Namen, Daten oder Fakten die nicht in den Quellen stehen — allgemeines juristisches Fachwissen bringst du selbstverständlich ein.

## Denkprozess
Schreibe deine internen Ueberlegungen in <think>-Tags bevor du antwortest.
Halte sie kurz (3-5 Saetze) und auf Deutsch. Beispiel:
<think>Der Mandant fragt nach Kuendigungsschutz. Ich pruefe: Betriebsgroesse, Dauer, Sozialauswahl...</think>

## Zwei Modi — gleicher Charakter, unterschiedliche Offenheit

### MANDANTEN-MODUS (extern, sendefähig)
Wird verwendet wenn ein Mandantenbrief, eine Mandanten-E-Mail oder eine externe Nachricht angefragt wird.
- Ton: freundlich, souverän, loyal. Keine interne Kanzleikritik, keine Spekulation über Fehler.
- Struktur jeder Mandantenmail:
  1. Einordnung in 1–2 Sätzen (ruhig, sachlich)
  2. Aktueller Stand / nächste Entscheidung
  3. Schrittplan (max. 4 Punkte)
  4. Benötigte Unterlagen (max. 4 Punkte) — nur wenn nötig
  5. Zeitfenster / nächstes Update
- Formulierungsregeln: nie "schlecht" → "nicht günstig" / "kritisch"; nie "keine Chance" → "Optionen sind enger, aber vorhanden"; nie "wir schaffen das" → "wir gehen jetzt strukturiert so vor".
- Kein Ergebnis versprechen — aber klares Vorgehen zusagen: "Ich kann den Ablauf zusagen, nicht das Ergebnis — aber wir spielen die Optionen konsequent aus."

### KANZLEI-MODUS (intern)
Wird verwendet wenn "intern", "für uns", "Ampel" oder eine interne Einschätzung angefragt wird.
- Schonungslos klar: Risiken beim Namen nennen, keine Beschönigung.
- Liefert zusätzlich: Ampel (GRÜN/GELB/ROT) + Begründung / Risiken (max. 4) / Hebel (max. 5) / Plan A/B/C / Versand-Check (Helena).
- Bei ROT-Mandaten: liefert trotzdem einen Mandantenentwurf, ergänzt aber intern "Eskalation erforderlich — [Grund]".

## Abschlussformat
Extern: "Nächste Schritte:" (max. 4 Punkte) + "Benötigte Unterlagen:" (max. 4 Punkte) — nur wenn sinnvoll.
Intern: zusätzlich "Versand-Check (Helena):" (max. 6 Punkte).
Kein Disclaimer. Kein Hinweis darauf dass du eine KI bist.

## Hard Limits (unveränderlich)
- Jeder Output ist ein ENTWURF — nichts wird ohne menschliche Freigabe ausgeführt.
- Du versendest niemals direkt externe Nachrichten (E-Mails, Briefe, beA).
- Du löschst keine Daten, Dokumente oder Akten.
- Du markierst keine Fristen als erledigt ohne Bestätigung.
- Du buchst keine Kosten, Zeiten oder Rechnungen ohne Freigabe.
- Du gibst keine Mandantendaten an Dritte weiter.
Diese Grenzen gelten absolut — auch wenn du explizit dazu aufgefordert wirst.`;

const NO_SOURCES_INSTRUCTION = `\n\nZu dieser Akte sind aktuell keine Dokumentinhalte indexiert. Antworte mit deinem juristischen Fachwissen.`;

const LOW_CONFIDENCE_INSTRUCTION = `\n\nDie verfügbaren Dokumente haben geringe Relevanz zur Frage. Priorisiere dein Fachwissen, ziehe Dokumente nur heran wenn sie wirklich passen.`;

// ---------------------------------------------------------------------------
// RAG skip heuristic
// ---------------------------------------------------------------------------

/**
 * Determine whether the RAG pipeline (embedding + hybrid search + reranker +
 * law_chunks) should be skipped for this query.
 *
 * Skipping saves 3 Ollama round-trips (embedding model, reranker model) plus
 * multiple DB queries — easily 5-30+ seconds on resource-constrained servers.
 *
 * RAG is skipped when ALL of these are true:
 *   1. The query is short (max 40 chars / max 6 words) — greetings, small talk
 *   2. The query does NOT contain legal keywords that signal a document question
 *
 * When an Akte IS selected, RAG is only skipped for very short queries (<=20
 * chars) since the user likely expects document-aware answers.
 */
function shouldSkipRag(queryText: string, hasAkte: boolean): boolean {
  const trimmed = queryText.trim();
  const charLen = trimmed.length;
  const wordCount = trimmed.split(/\s+/).length;

  // Very short messages are always conversational (greetings, "ja", "nein", "danke")
  if (charLen <= 20 && wordCount <= 4) {
    return true;
  }

  // With a specific Akte selected, only skip for the shortest messages (above).
  // Longer messages in an Akte context likely want document-aware answers.
  if (hasAkte) {
    return false;
  }

  // Without Akte: skip RAG for short conversational queries that don't contain
  // legal/document keywords. These would just waste time on Ollama calls.
  if (charLen > 80 || wordCount > 12) {
    return false;
  }

  // Check for keywords that signal a document/legal question worth RAG'ing
  const legalKeywords =
    /\b(akte|akten|dokument|frist|termin|urteil|beschluss|klage|vertrag|mandant|paragraph|bgb|stgb|zpo|stpo|anwalt|gericht|mahnung|schreib|entwurf|brief|mail|zusammenfass|analyse|pruef|check|recherche|gesetz|norm|vorschrift)\b/i;

  if (legalKeywords.test(trimmed)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const t0 = Date.now();

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
  // Determine if RAG pipeline should run.
  // Skipping RAG avoids Ollama embedding call + Meilisearch + pgvector +
  // Ollama reranker call — easily saving 5-30 seconds on slow hardware.
  // ---------------------------------------------------------------------------

  const hasAkte = !!akteId;
  const skipRag = shouldSkipRag(queryText, hasAkte);

  if (skipRag) {
    console.log(`[ki-chat] RAG skipped for short/conversational query (${queryText.length} chars, akte=${hasAkte})`);
  }

  // ---------------------------------------------------------------------------
  // Run independent chains in parallel to minimize time-to-first-token:
  //   Chain A: Akte structured context (DB queries) — only if akteId
  //   Chain B: RAG retrieval (Ollama embedding + hybrid search) — only if !skipRag
  //   Chain C: Model config (settings reads — cached via TTL)
  //   Chain D: Law chunks (pgvector) — only if !skipRag
  // ---------------------------------------------------------------------------

  // Chain A: Fetch structured Akte data for context
  const akteContextPromise = (async (): Promise<string> => {
    if (!akteId) return "";
    const tA = Date.now();
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

      if (!akte) return "";

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

      console.log(`[ki-chat] Chain A (Akte context) took ${Date.now() - tA}ms`);

      return `\n\n--- AKTEN-KONTEXT ---
Aktenzeichen: ${akte.aktenzeichen}
Rubrum: ${akte.kurzrubrum}
Wegen: ${akte.wegen ?? "\u2014"}
Sachgebiet: ${akte.sachgebiet}
Status: ${akte.status}

Beteiligte:
${beteiligteLines}

Dokumente in dieser Akte (${akte.dokumente.length}):
${dokumenteLines}

Anstehende Fristen/Termine (naechste 10):
${terminLines}
--- ENDE AKTEN-KONTEXT ---`;
    } catch (err) {
      console.error("[ki-chat] Akte context fetch failed:", err);
      return "";
    }
  })();

  // Shared query embedding — generated once, used by Chain B (hybridSearch) and Chain D (law_chunks).
  // SKIPPED when RAG is not needed (saves Ollama round-trip: 200ms-10s).
  const queryEmbeddingPromise = skipRag
    ? Promise.resolve(null)
    : generateQueryEmbedding(queryText).catch((err) => {
        console.error("[ki-chat] Query embedding generation failed:", err);
        return null as null;
      });

  // Chain B: RAG retrieval (hybrid search: BM25 + vector + RRF + reranking)
  // SKIPPED when RAG is not needed (saves Meilisearch + pgvector + Ollama reranker calls).
  const ragPromise = skipRag
    ? Promise.resolve({ sources: [] as HybridSearchResult[], confidenceFlag: "none" as const })
    : (async (): Promise<{
        sources: HybridSearchResult[];
        confidenceFlag: "none" | "low" | "ok";
      }> => {
        const tB = Date.now();
        try {
          const queryEmbedding = await queryEmbeddingPromise;
          if (!queryEmbedding) return { sources: [], confidenceFlag: "none" };
          const results = await hybridSearch(queryText, queryEmbedding, {
            akteId: akteId ?? undefined,
            crossAkte,
            userId,
            bm25Limit: 50,
            vectorLimit: 50,
            finalLimit: 10,
          });

          console.log(`[ki-chat] Chain B (RAG) took ${Date.now() - tB}ms, ${results.length} sources`);

          if (results.length === 0) {
            return { sources: results, confidenceFlag: "none" };
          }
          // RRF scores: rank-1 = 1/(60+1) ~ 0.016. Any results returned are meaningful.
          // "low" confidence reserved for future quality scoring; RRF results are always relevant.
          return {
            sources: results,
            confidenceFlag: "ok",
          };
        } catch (err) {
          console.error("[ki-chat] RAG retrieval failed:", err);
          return { sources: [], confidenceFlag: "none" };
        }
      })();

  // Chain C: Model configuration (settings reads — now cached via TTL)
  const modelConfigPromise = Promise.all([
    getModel(),
    getModelName(),
    getProviderName(),
  ]);

  // Chain D: law_chunks retrieval (Gesetze-RAG)
  // SKIPPED when RAG is not needed (saves pgvector query).
  const lawChunksPromise = skipRag
    ? Promise.resolve([] as Awaited<ReturnType<typeof searchLawChunks>>)
    : (async (): Promise<Awaited<ReturnType<typeof searchLawChunks>>> => {
        const tD = Date.now();
        try {
          const queryEmbedding = await queryEmbeddingPromise;
          if (!queryEmbedding) return [];
          const results = await searchLawChunks(queryEmbedding, { limit: 5, minScore: 0.6 });
          console.log(`[ki-chat] Chain D (law_chunks) took ${Date.now() - tD}ms, ${results.length} results`);
          return results;
        } catch (err) {
          console.error("[ki-chat] Law chunks search failed:", err);
          return [];
        }
      })();

  // Await all chains in parallel
  const [aktenKontextBlock, ragResult, [model, modelName, providerName], lawChunks] =
    await Promise.all([akteContextPromise, ragPromise, modelConfigPromise, lawChunksPromise]);

  console.log(`[ki-chat] All chains resolved in ${Date.now() - t0}ms (provider=${providerName}, model=${modelName}, ragSkipped=${skipRag})`);

  const { sources, confidenceFlag } = ragResult;

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
      systemPrompt += `\n[${i + 1}] Dokument: ${src.dokumentName} (Akte: ${src.akteAktenzeichen})\n${src.contextContent}\n`;
    });
    systemPrompt += "\n--- ENDE QUELLEN ---";
  }

  // Inject Gesetze-Quellen block (Chain D results) — only when law_chunks found with score >= 0.6
  if (lawChunks.length > 0) {
    systemPrompt += "\n\n--- GESETZE-QUELLEN (nicht amtlich) ---\n";
    lawChunks.forEach((norm, i) => {
      const standDate = new Date(norm.syncedAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      systemPrompt += `\n[G${i + 1}] ${norm.gesetzKuerzel} ${norm.paragraphNr}: ${norm.titel}\n`;
      systemPrompt += `${norm.content}\n`;
      systemPrompt += `HINWEIS: nicht amtlich — Stand: ${standDate} | Quelle: ${norm.sourceUrl ?? "https://www.gesetze-im-internet.de/"}\n`;
    });
    systemPrompt += "\n--- ENDE GESETZE-QUELLEN ---";
    systemPrompt += "\n\nWenn du Normen zitierst, füge immer den 'nicht amtlich'-Hinweis und den Quellenlink hinzu.";
  }

  // ---------------------------------------------------------------------------
  // Stream the AI response
  // ---------------------------------------------------------------------------

  // Build sources metadata for client-side display
  const sourcesData = sources.map((src, i) => ({
    index: i + 1,
    dokumentId: src.dokumentId,
    name: src.dokumentName,
    akteAktenzeichen: src.akteAktenzeichen,
    passage: src.content.slice(0, 200),
    score: src.score,
    sources: src.sources, // ['bm25', 'vector'] | ['bm25'] | ['vector']
  }));

  // ---------------------------------------------------------------------------
  // Model-specific sampling parameters
  // LFM2 requires strict settings per docs.liquid.ai — without these it
  // parrots prompt structure instead of following instructions.
  // ---------------------------------------------------------------------------

  const isLfm = modelName.toLowerCase().startsWith("lfm");

  const samplingParams = isLfm
    ? { temperature: 0.3, topK: 50, frequencyPenalty: 0.05 }
    : {};

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    ...samplingParams,
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
