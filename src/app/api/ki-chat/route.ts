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
import { searchUrteilChunks, type UrteilChunkResult } from "@/lib/urteile/ingestion";
import { searchMusterChunks, type MusterChunkResult } from "@/lib/muster/ingestion";
import {
  isSchriftsatzIntent,
  runSchriftsatzPipeline,
  loadPendingPipeline,
  savePendingPipeline,
  clearPendingPipeline,
  MAX_ROUNDS,
} from "@/lib/helena/schriftsatz";
import {
  classifyAnswerIntent,
  extractSlotValues,
} from "@/lib/helena/schriftsatz/answer-parser";

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

  console.log(`[ki-chat] POST received — akteId=${akteId ?? "NULL"}, conversationId=${conversationId ?? "NULL"}, crossAkte=${crossAkte}, messages=${messages?.length ?? 0}`);

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
  // Schriftsatz Pipeline Routing (ORCH-04 multi-turn Rueckfragen)
  // Check BEFORE RAG pipeline: pending state takes priority
  // ---------------------------------------------------------------------------

  if (akteId) {
    // Check for pending Schriftsatz pipeline
    const pending = await loadPendingPipeline(userId, akteId);

    if (pending) {
      // Check for new Schriftsatz request while one is pending
      if (isSchriftsatzIntent(queryText)) {
        const responsePayload = {
          type: "schriftsatz_conflict" as const,
          text: `Du hast noch einen offenen Entwurf fuer einen Schriftsatz. Verwerfen und neu starten?`,
          pendingRueckfrage: pending.rueckfrage,
          round: pending.round,
          maxRounds: MAX_ROUNDS,
        };
        return new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Classify: is this message an answer, correction, cancel, or unrelated?
      const intent = await classifyAnswerIntent(
        queryText,
        pending.rueckfrage,
        pending.slotState,
      );

      if (intent.type === "cancel") {
        await clearPendingPipeline(userId, akteId);
        // Fall through to normal RAG chat -- do NOT return here
      } else if (intent.type === "unrelated") {
        await clearPendingPipeline(userId, akteId);
        // Fall through to normal RAG chat
      } else {
        // "answer" or "correction" -- extract slot values and resume pipeline
        console.log(`[ki-chat] Resuming Schriftsatz pipeline (round ${pending.round + 1}/${MAX_ROUNDS})`);

        // Determine expected slot keys from existing state
        const missingKeys = Object.entries(pending.slotState)
          .filter(([, v]) => v === null)
          .map(([k]) => k);

        // If correction, include the corrected slot key
        const expectedKeys = intent.type === "correction" && intent.correctedSlotKey
          ? Array.from(new Set([...missingKeys, intent.correctedSlotKey]))
          : missingKeys;

        const extracted = await extractSlotValues(
          queryText,
          pending.rueckfrage,
          expectedKeys,
          pending.slotState,
        );

        // Merge extracted values into existing slot state
        const mergedSlotValues: Record<string, string | number | boolean | null> = {
          ...pending.slotState,
        };
        for (const [key, value] of Object.entries(extracted)) {
          if (value !== undefined && value !== null && value !== "") {
            mergedSlotValues[key] = value;
          }
        }

        const newRound = pending.round + 1;

        // Re-run the full pipeline with merged userSlotValues
        const userRole = (session?.user as any)?.role ?? "SACHBEARBEITER";
        const userName = session?.user?.name ?? "Nutzer";

        const pipelineResult = await runSchriftsatzPipeline({
          prisma,
          userId,
          userRole,
          userName,
          akteId,
          message: pending.message, // Original message that started the pipeline
          userSlotValues: mergedSlotValues,
        });

        if (pipelineResult.status === "needs_input" && newRound < MAX_ROUNDS) {
          // Save updated state and return Rueckfrage
          await savePendingPipeline({
            userId,
            akteId,
            intentState: pipelineResult.intentState!,
            slotState: pipelineResult.slotState!,
            rueckfrage: pipelineResult.rueckfrage!,
            round: newRound,
            message: pending.message,
          });

          // Build response with round counter and slot context
          const filledSlots = Object.entries(pipelineResult.slotState ?? {})
            .filter(([, v]) => v !== null && !(typeof v === "string" && v.startsWith("{{")))
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, unknown>);

          const responsePayload = {
            type: "schriftsatz_rueckfrage" as const,
            rueckfrage: pipelineResult.rueckfrage!,
            round: newRound,
            maxRounds: MAX_ROUNDS,
            filledSlots,
          };

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (pipelineResult.status === "needs_input" && newRound >= MAX_ROUNDS) {
          // Round cap reached -- create draft with PLATZHALTERs
          // Clear pending state, then run pipeline one more time forcing completion
          await clearPendingPipeline(userId, akteId);

          // Build list of unresolved PLATZHALTERs
          const unresolved = Object.entries(pipelineResult.slotState ?? {})
            .filter(([, v]) => v === null || (typeof v === "string" && v.startsWith("{{")))
            .map(([k]) => k);

          const fallbackMessage = `Ich erstelle den Entwurf mit Platzhaltern fuer: ${unresolved.join(", ")}. Diese kannst du spaeter ergaenzen.`;

          // Force-complete the pipeline by filling missing slots with PLATZHALTERs
          const forcedSlotValues = { ...mergedSlotValues };
          for (const key of unresolved) {
            forcedSlotValues[key] = `{{${key}}}`;
          }

          const forcedResult = await runSchriftsatzPipeline({
            prisma,
            userId,
            userRole,
            userName,
            akteId,
            message: pending.message,
            userSlotValues: forcedSlotValues,
          });

          const responsePayload = {
            type: "schriftsatz_complete" as const,
            text: fallbackMessage,
            draftId: forcedResult.draftId ?? null,
            warnungen: forcedResult.warnungen,
          };

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Pipeline complete or error -- clear pending state
        await clearPendingPipeline(userId, akteId);

        if (pipelineResult.status === "complete") {
          const responsePayload = {
            type: "schriftsatz_complete" as const,
            text: `Schriftsatz erstellt. Der Entwurf liegt zur Pruefung bereit.`,
            draftId: pipelineResult.draftId ?? null,
            warnungen: pipelineResult.warnungen,
          };

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Error case
        const errorPayload = {
          type: "schriftsatz_error" as const,
          text: "Beim Erstellen des Schriftsatzes ist ein Fehler aufgetreten. Bitte versuche es erneut.",
          warnungen: pipelineResult.warnungen,
        };

        return new Response(JSON.stringify(errorPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // No pending state -- check for new Schriftsatz intent
    if (!pending && isSchriftsatzIntent(queryText)) {
      console.log(`[ki-chat] New Schriftsatz intent detected -- routing to pipeline`);

      const userRole = (session?.user as any)?.role ?? "SACHBEARBEITER";
      const userName = session?.user?.name ?? "Nutzer";

      const pipelineResult = await runSchriftsatzPipeline({
        prisma,
        userId,
        userRole,
        userName,
        akteId,
        message: queryText,
      });

      if (pipelineResult.status === "needs_input") {
        // Save state for multi-turn
        await savePendingPipeline({
          userId,
          akteId,
          intentState: pipelineResult.intentState!,
          slotState: pipelineResult.slotState!,
          rueckfrage: pipelineResult.rueckfrage!,
          round: 1,
          message: queryText,
        });

        const filledSlots = Object.entries(pipelineResult.slotState ?? {})
          .filter(([, v]) => v !== null && !(typeof v === "string" && v.startsWith("{{")))
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, unknown>);

        const responsePayload = {
          type: "schriftsatz_rueckfrage" as const,
          rueckfrage: pipelineResult.rueckfrage!,
          round: 1,
          maxRounds: MAX_ROUNDS,
          filledSlots,
        };

        return new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (pipelineResult.status === "complete") {
        const responsePayload = {
          type: "schriftsatz_complete" as const,
          text: `Schriftsatz erstellt. Der Entwurf liegt zur Pruefung bereit.`,
          draftId: pipelineResult.draftId ?? null,
          warnungen: pipelineResult.warnungen,
        };

        return new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Error -- fall through to normal RAG
      console.error("[ki-chat] Schriftsatz pipeline error, falling back to RAG");
    }
  }
  // If no Schriftsatz routing matched, continue to normal RAG pipeline below

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
  //   Chain E: Urteil chunks (pgvector) — only if !skipRag
  //   Chain F: Muster chunks (pgvector, ARBW-05) — only if !skipRag
  // ---------------------------------------------------------------------------

  // Chain A: Fetch structured Akte data for context + pinned normen injection
  const akteContextPromise = (async (): Promise<{ aktenKontextBlock: string; pinnedNormenBlock: string }> => {
    if (!akteId) {
      console.log("[ki-chat] Chain A SKIPPED — no akteId");
      return { aktenKontextBlock: "", pinnedNormenBlock: "" };
    }
    console.log(`[ki-chat] Chain A START — fetching akteId=${akteId}`);
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

      if (!akte) return { aktenKontextBlock: "", pinnedNormenBlock: "" };

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
        >`SELECT id, LEFT("ocrText", 500) as snippet FROM "dokumente" WHERE id = ANY(${ocrDocIds}) AND "ocrText" IS NOT NULL`;
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

      const akteContextStr = `\n\n--- AKTEN-KONTEXT ---
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

      // Fetch pinned normen for this Akte — parallel per-norm LawChunk lookup.
      // CRITICAL: Cannot JOIN AkteNorm with LawChunk via Prisma include because
      // LawChunk has Unsupported("vector(1024)") which blocks Prisma JOINs.
      let pinnedNormenBlock = "";

      const pinnedNormen = await prisma.akteNorm.findMany({
        where: { akteId },
        orderBy: { createdAt: "asc" },
      });

      if (pinnedNormen.length > 0) {
        const chunks = await Promise.all(
          pinnedNormen.map((norm) =>
            prisma.lawChunk.findFirst({
              where: {
                gesetzKuerzel: norm.gesetzKuerzel,
                paragraphNr: norm.paragraphNr,
              },
              select: { titel: true, content: true, sourceUrl: true, syncedAt: true },
            })
          )
        );

        pinnedNormenBlock = `\n\n--- PINNED NORMEN (Akte ${akte.aktenzeichen} — höchste Priorität) ---\n`;
        pinnedNormen.forEach((norm, i) => {
          const chunk = chunks[i];
          if (!chunk) return; // Skip if law_chunk no longer exists — guard against null
          const standDate = new Date(chunk.syncedAt).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          pinnedNormenBlock += `\n[P${i + 1}] ${norm.gesetzKuerzel} ${norm.paragraphNr}: ${chunk.titel}\n`;
          pinnedNormenBlock += `${chunk.content}\n`;
          if (norm.anmerkung) {
            pinnedNormenBlock += `Anmerkung des Anwalts: ${norm.anmerkung}\n`;
          }
          pinnedNormenBlock += `HINWEIS: nicht amtlich — Stand: ${standDate} | Quelle: ${chunk.sourceUrl ?? "https://www.gesetze-im-internet.de/"}\n`;
        });
        pinnedNormenBlock += "\n--- ENDE PINNED NORMEN ---";
        pinnedNormenBlock += "\n\nDiese Normen wurden vom Anwalt explizit für diese Akte verknüpft. Beziehe dich bevorzugt auf diese §§.";
      }

      console.log(`[ki-chat] Chain A (Akte context + pinned normen) took ${Date.now() - tA}ms (${pinnedNormen.length} pinned norms)`);

      return { aktenKontextBlock: akteContextStr, pinnedNormenBlock };
    } catch (err) {
      console.error("[ki-chat] Akte context fetch failed:", err);
      return { aktenKontextBlock: "", pinnedNormenBlock: "" };
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

  // Chain E: urteil_chunks retrieval (Urteile-RAG)
  // Non-fatal — error returns [] and Helena responds without Urteile.
  const urteilChunksPromise = skipRag
    ? Promise.resolve([] as UrteilChunkResult[])
    : (async (): Promise<UrteilChunkResult[]> => {
        const tE = Date.now();
        try {
          const queryEmbedding = await queryEmbeddingPromise;
          if (!queryEmbedding) return [];
          const results = await searchUrteilChunks(queryEmbedding, { limit: 5, minScore: 0.6 });
          console.log(`[ki-chat] Chain E (urteil_chunks) took ${Date.now() - tE}ms, ${results.length} results`);
          return results;
        } catch (err) {
          console.error("[ki-chat] Urteil chunks search failed:", err);
          return [];
        }
      })();

  // Chain F: muster_chunks retrieval (Muster-RAG, ARBW-05)
  // Schriftsatzmuster für strukturierte Entwürfe (kanzlei-eigene + amtliche Formulare)
  const musterChunksPromise = skipRag
    ? Promise.resolve([] as MusterChunkResult[])
    : (async (): Promise<MusterChunkResult[]> => {
        const tF = Date.now();
        try {
          const queryEmbedding = await queryEmbeddingPromise;
          if (!queryEmbedding) return [];
          const results = await searchMusterChunks(queryEmbedding, { limit: 5, minScore: 0.55 });
          console.log(`[ki-chat] Chain F (muster_chunks) took ${Date.now() - tF}ms, ${results.length} results`);
          return results;
        } catch (err) {
          console.error("[ki-chat] Muster chunks search failed:", err);
          return [];
        }
      })();

  // Await all chains in parallel
  const [{ aktenKontextBlock, pinnedNormenBlock }, ragResult, [model, modelName, providerName], lawChunks, urteilChunks, musterChunks] =
    await Promise.all([akteContextPromise, ragPromise, modelConfigPromise, lawChunksPromise, urteilChunksPromise, musterChunksPromise]);

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

  // Pinned norms — highest legal priority context for this Akte.
  // Injected BEFORE document QUELLEN and auto-retrieved GESETZE-QUELLEN so
  // the model treats them as the lawyer's explicit legal strategy.
  if (pinnedNormenBlock) {
    systemPrompt += pinnedNormenBlock;
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

  // Inject Urteile-Quellen block (Chain E results) — only when urteil_chunks found with score >= 0.6
  // URTEIL-04: All citation fields (gericht, aktenzeichen, datum, sourceUrl) come from DB — never LLM-generated.
  if (urteilChunks.length > 0) {
    systemPrompt += "\n\n--- URTEILE-QUELLEN ---\n";
    urteilChunks.forEach((u, i) => {
      const datumStr = new Date(u.datum).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      systemPrompt += `\n[U${i + 1}] ${u.gericht} ${u.aktenzeichen} vom ${datumStr}\n`;
      systemPrompt += `${u.content}\n`;
      systemPrompt += `Quelle: ${u.sourceUrl}\n`;
    });
    systemPrompt += "\n--- ENDE URTEILE-QUELLEN ---";
    systemPrompt += "\n\nWenn du Urteile zitierst: immer Gericht + Aktenzeichen + Datum + Quellenlink angeben.";
    systemPrompt += " Wenn kein Aktenzeichen in den URTEILE-QUELLEN steht, zitiere das Urteil NICHT und erfinde kein AZ.";
  }

  // Inject Muster-Quellen block (Chain F results) — Schriftsatz-RAG (ARBW-05)
  if (musterChunks.length > 0) {
    systemPrompt += "\n\n--- MUSTER-QUELLEN ---\n";
    systemPrompt += "Nutze diese Schriftsatzmuster als Strukturvorlage. Übernimm den Aufbau (Rubrum, Anträge, Begründung) und fülle alle {{PLATZHALTER}} mit den Akte-Daten — oder behalte sie als explizite Platzhalter wenn Daten fehlen.\n";
    musterChunks.forEach((m, i) => {
      const herkunft = m.kanzleiEigen ? "Kanzlei-Muster" : "Amtliches Formular";
      systemPrompt += `\n[M${i + 1}] ${m.musterName} (${herkunft}, Kategorie: ${m.kategorie})\n`;
      systemPrompt += `${m.parentContent ?? m.content}\n`;
    });
    systemPrompt += "\n--- ENDE MUSTER-QUELLEN ---";
    systemPrompt += "\n\nWenn du einen Schriftsatz-Entwurf erstellst: Beginne mit RUBRUM (Kläger, Beklagte, Gericht), dann ANTRÄGE (nummeriert), dann BEGRÜNDUNG (I., II., ...). Alle fehlenden Angaben als {{PLATZHALTER}}. Schließe ab mit: '\u26a0\ufe0f ENTWURF — Platzhalter prüfen und vor Einreichung ausfüllen.'";
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
