/**
 * Helena Memory Service
 *
 * Per-Akte memory lifecycle: load, generate, refresh, format for prompt.
 *
 * Provides:
 * - loadOrRefresh(): Main entry point -- loads existing memory, detects staleness
 *   via Akte.geaendert, auto-regenerates via LLM when stale, preserves
 *   rejectionPatterns from draft-service.ts
 * - formatMemoryForPrompt(): Pure function rendering HelenaMemoryContent into
 *   structured German markdown for system prompt injection
 * - generateMemory(): Internal function using generateObject with Zod schema
 *   to produce structured case memory from Akte data + conversation history
 *
 * Phase 25 (MEM-02, MEM-03, MEM-04)
 */

import { z } from "zod";
import { generateObject } from "ai";
import type { Prisma } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/db";
import { getModel } from "@/lib/ai/provider";
import { estimateTokens } from "@/lib/helena/token-budget";
import { createLogger } from "@/lib/logger";

const log = createLogger("helena-memory");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for structured Helena memory content.
 * Matches the locked content structure from CONTEXT.md.
 */
export const HelenaMemoryContentSchema = z.object({
  summary: z.string().describe("Detaillierte Fallzusammenfassung in 1-2 Absaetzen"),
  risks: z.array(z.string()).describe("Erkannte Risiken und Schwachstellen"),
  nextSteps: z.array(z.string()).describe("Ausstehende Handlungen und Fristen"),
  openQuestions: z.array(z.string()).describe("Unbeantwortete Fragen zum Fall"),
  relevantNorms: z.array(z.string()).describe("Relevante Rechtsnormen, z.B. 'BGB SS 626'"),
  strategy: z.string().describe("Strategie des Anwalts aus bisherigen Gespraechen"),
  keyEvents: z.array(z.object({
    date: z.string().describe("Datum im Format TT.MM.JJJJ"),
    event: z.string().describe("Beschreibung des Ereignisses"),
  })).describe("Chronologie wichtiger Fallereignisse"),
  beteiligteNotes: z.record(z.string(), z.string()).describe("Erkenntnisse pro Beteiligtem (Name -> Erkenntnis)"),
  proceduralStatus: z.string().describe("Aktueller Verfahrensstand in einem Satz"),
});

export type HelenaMemoryContent = z.infer<typeof HelenaMemoryContentSchema>;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface LoadOrRefreshResult {
  content: HelenaMemoryContent | null;
  changes?: string[];
  refreshed: boolean;
}

// ---------------------------------------------------------------------------
// Meta type for change detection
// ---------------------------------------------------------------------------

interface MemoryMeta {
  dokumentCount: number;
  beteiligteCount: number;
  fristenCount: number;
}

// ---------------------------------------------------------------------------
// Cooldown management (in-memory, process-local)
// ---------------------------------------------------------------------------

const refreshCooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isOnCooldown(akteId: string, cooldownMs: number): boolean {
  const lastRefresh = refreshCooldowns.get(akteId);
  if (!lastRefresh) return false;
  return Date.now() - lastRefresh < cooldownMs;
}

function markRefreshed(akteId: string): void {
  refreshCooldowns.set(akteId, Date.now());

  // Prevent memory leak: clean up entries older than 1 hour if map gets large
  if (refreshCooldowns.size > 1000) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    Array.from(refreshCooldowns.entries()).forEach(([key, ts]) => {
      if (ts < oneHourAgo) refreshCooldowns.delete(key);
    });
  }
}

// ---------------------------------------------------------------------------
// Memory generation system prompt
// ---------------------------------------------------------------------------

const MEMORY_GENERATION_SYSTEM_PROMPT = `Du bist Helena, juristische KI-Assistentin. Deine Aufgabe: Erstelle eine strukturierte Fallzusammenfassung fuer eine Akte.

Analysiere die Akte-Daten und die bisherigen Gespraeche und erstelle:
1. **summary**: Detaillierte Zusammenfassung des Falls (Sachverhalt, Parteien, Kernkonflikt, Verfahrensstand) in 1-2 Absaetzen
2. **risks**: Erkannte Risiken und Schwachstellen der Position
3. **nextSteps**: Konkrete naechste Handlungen
4. **openQuestions**: Unbeantwortete Fragen die geklaert werden muessen
5. **relevantNorms**: Anwendbare Rechtsnormen (Format: "BGB SS 626")
6. **strategy**: Falls aus Gespraechen erkennbar, die Strategie des Anwalts
7. **keyEvents**: Chronologie der wichtigsten Ereignisse mit Datum (Format TT.MM.JJJJ)
8. **beteiligteNotes**: Erkenntnisse zu einzelnen Beteiligten (Name als Key, Erkenntnis als Value)
9. **proceduralStatus**: Aktueller Verfahrensstand in einem Satz

REGELN:
- Schreibe auf Deutsch
- Erfinde keine Fakten -- nur was in den Daten steht
- Fasse Gespraeche zusammen, zitiere nicht woertlich
- Halte die Zusammenfassung praegnant aber vollstaendig
- Wenn keine Gespraeche vorliegen, nutze nur die Akte-Daten
- Leere Arrays/Strings fuer Felder ohne passende Informationen`;

// ---------------------------------------------------------------------------
// formatMemoryForPrompt (pure function)
// ---------------------------------------------------------------------------

/**
 * Render HelenaMemoryContent into structured German markdown for system prompt.
 * Caps total output at ~2000 tokens (~7000 chars).
 * Only renders sections that have content.
 */
export function formatMemoryForPrompt(
  content: HelenaMemoryContent,
  changes?: string[],
): string {
  const MAX_CHARS = 7000;

  const now = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let md = `\n\n## Fallgedaechtnis (Stand: ${now})\n`;

  if (changes && changes.length > 0) {
    md += `\n### Aenderungen seit letztem Gespraech\n`;
    md += changes.map((c) => `- ${c}`).join("\n") + "\n";
  }

  if (content.summary) {
    md += `\n### Zusammenfassung\n${content.summary}\n`;
  }

  if (content.risks.length > 0) {
    md += `\n### Erkannte Risiken\n`;
    md += content.risks.map((r) => `- ${r}`).join("\n") + "\n";
  }

  if (content.strategy) {
    md += `\n### Strategie\n${content.strategy}\n`;
  }

  if (content.nextSteps.length > 0) {
    md += `\n### Naechste Schritte\n`;
    md += content.nextSteps.map((s) => `- ${s}`).join("\n") + "\n";
  }

  if (content.openQuestions.length > 0) {
    md += `\n### Offene Fragen\n`;
    md += content.openQuestions.map((q) => `- ${q}`).join("\n") + "\n";
  }

  if (content.relevantNorms.length > 0) {
    md += `\n### Relevante Normen\n`;
    md += content.relevantNorms.map((n) => `- ${n}`).join("\n") + "\n";
  }

  if (content.keyEvents.length > 0) {
    md += `\n### Chronologie\n`;
    md += content.keyEvents.map((e) => `- ${e.date}: ${e.event}`).join("\n") + "\n";
  }

  const beteiligteEntries = Object.entries(content.beteiligteNotes);
  if (beteiligteEntries.length > 0) {
    md += `\n### Beteiligte\n`;
    md += beteiligteEntries.map(([name, note]) => `- **${name}**: ${note}`).join("\n") + "\n";
  }

  if (content.proceduralStatus) {
    md += `\n### Verfahrensstand\n${content.proceduralStatus}\n`;
  }

  // Token budget cap: if over ~2000 tokens (~7000 chars), truncate summary
  if (md.length > MAX_CHARS) {
    // Rebuild with truncated summary
    const overBy = md.length - MAX_CHARS + 10; // +10 for "[...]" marker
    if (content.summary.length > overBy) {
      const truncatedSummary = content.summary.slice(0, content.summary.length - overBy) + " [...]";
      const truncatedContent = { ...content, summary: truncatedSummary };
      return formatMemoryForPrompt(truncatedContent, changes);
    }
    // If summary alone can't fix it, just hard-truncate the output
    return md.slice(0, MAX_CHARS) + "\n[...]\n";
  }

  return md;
}

// ---------------------------------------------------------------------------
// generateMemory (internal)
// ---------------------------------------------------------------------------

/**
 * Generate memory content via LLM using generateObject.
 * Loads Akte data and recent conversations to build context.
 */
async function generateMemory(
  prisma: ExtendedPrismaClient,
  akteId: string,
  _previousMemory?: HelenaMemoryContent | null,
): Promise<HelenaMemoryContent> {
  // Load Akte data with related entities
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    include: {
      beteiligte: {
        include: { kontakt: true },
      },
      dokumente: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          name: true,
          mimeType: true,
          createdAt: true,
          ordner: true,
        },
      },
      kalenderEintraege: {
        where: { erledigt: false },
        orderBy: { datum: "asc" },
        take: 20,
      },
    },
  });

  if (!akte) {
    throw new Error(`Akte ${akteId} not found`);
  }

  // Load recent AiConversation history for this Akte
  const conversations = await prisma.aiConversation.findMany({
    where: { akteId },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      titel: true,
      messages: true,
    },
  });

  // Build prompt with Akte structured data
  const formatDate = (d: Date) =>
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const beteiligteStr = akte.beteiligte
    .map((b) => {
      const name =
        b.kontakt.firma ??
        [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ") ??
        "Unbekannt";
      return `- ${name} (${b.rolle})`;
    })
    .join("\n");

  const dokumenteStr = akte.dokumente
    .map((d) => `- ${d.name} (${d.mimeType}, ${formatDate(d.createdAt)})${d.ordner ? ` [${d.ordner}]` : ""}`)
    .join("\n");

  const fristenStr = akte.kalenderEintraege
    .map((e) => {
      const flags = [e.typ, e.istNotfrist ? "NOTFRIST" : null].filter(Boolean).join(", ");
      return `- ${formatDate(e.datum)}: ${e.titel} (${flags})`;
    })
    .join("\n");

  // Summarize conversations (cap at ~2000 chars total)
  let conversationStr = "";
  if (conversations.length > 0) {
    const convSummaries: string[] = [];
    let totalChars = 0;
    for (const conv of conversations) {
      const msgs = Array.isArray(conv.messages) ? conv.messages : [];
      // Extract last 3 messages per conversation for summary
      const recentMsgs = msgs.slice(-3);
      const summary = recentMsgs
        .map((m: any) => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 200) : "..."}`)
        .join("\n  ");
      const entry = `### ${conv.titel}\n  ${summary}`;
      if (totalChars + entry.length > 2000) break;
      convSummaries.push(entry);
      totalChars += entry.length;
    }
    conversationStr = convSummaries.join("\n\n");
  }

  const prompt = `# Akte: ${akte.aktenzeichen}
Rubrum: ${akte.kurzrubrum}
Wegen: ${akte.wegen ?? "---"}
Sachgebiet: ${akte.sachgebiet}
Status: ${akte.status}

## Beteiligte
${beteiligteStr || "(keine)"}

## Dokumente (letzte 30)
${dokumenteStr || "(keine)"}

## Fristen/Termine (naechste 20, aktiv)
${fristenStr || "(keine)"}

## Bisherige Helena-Gespraeche (${conversations.length})
${conversationStr || "Keine bisherigen Helena-Gespraeche vorhanden."}`;

  // LLM call via generateObject
  const model = await getModel();

  const result = await generateObject({
    model,
    schema: HelenaMemoryContentSchema,
    system: MEMORY_GENERATION_SYSTEM_PROMPT,
    prompt,
  });

  return result.object;
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * Detect changes between previous _meta and current Akte data.
 * Returns human-readable German change descriptions.
 */
function detectChanges(
  previousMeta: MemoryMeta | undefined,
  currentMeta: MemoryMeta,
): string[] {
  if (!previousMeta) {
    return ["Erste Analyse dieser Akte"];
  }

  const changes: string[] = [];

  const newDocs = currentMeta.dokumentCount - previousMeta.dokumentCount;
  if (newDocs > 0) {
    changes.push(`${newDocs} neue${newDocs === 1 ? "s Dokument" : " Dokumente"}`);
  }

  const newBeteiligte = currentMeta.beteiligteCount - previousMeta.beteiligteCount;
  if (newBeteiligte > 0) {
    changes.push(`${newBeteiligte} neue${newBeteiligte === 1 ? "r Beteiligter" : " Beteiligte"}`);
  }

  const newFristen = currentMeta.fristenCount - previousMeta.fristenCount;
  if (newFristen > 0) {
    changes.push(`${newFristen} neue${newFristen === 1 ? " Frist" : " Fristen"}`);
  }

  return changes.length > 0 ? changes : ["Akte wurde aktualisiert"];
}

// ---------------------------------------------------------------------------
// loadOrRefresh (main entry point)
// ---------------------------------------------------------------------------

/**
 * Load Helena memory for an Akte, auto-refreshing if stale.
 *
 * Handles:
 * - Fresh generation (no existing memory)
 * - Staleness detection (Akte.geaendert > memory.lastRefreshedAt)
 * - Cooldown to prevent rapid-fire regeneration (default 5 minutes)
 * - Preserves rejectionPatterns from draft-service.ts across refreshes
 * - _meta tracking for change detection
 *
 * Never throws -- returns existing (stale) content on LLM failure.
 */
export async function loadOrRefresh(
  prisma: ExtendedPrismaClient,
  akteId: string,
  options?: { cooldownMs?: number },
): Promise<LoadOrRefreshResult> {
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  try {
    // Step 1: Load HelenaMemory + Akte.geaendert in parallel
    const [memory, akte] = await Promise.all([
      prisma.helenaMemory.findUnique({ where: { akteId } }),
      prisma.akte.findUnique({
        where: { id: akteId },
        select: {
          geaendert: true,
          _count: {
            select: {
              dokumente: true,
              beteiligte: true,
              kalenderEintraege: true,
            },
          },
        },
      }),
    ]);

    // Step 2: No akte found
    if (!akte) {
      log.warn({ akteId }, "Akte not found for memory loading");
      return { content: null, refreshed: false };
    }

    const currentMeta: MemoryMeta = {
      dokumentCount: akte._count.dokumente,
      beteiligteCount: akte._count.beteiligte,
      fristenCount: akte._count.kalenderEintraege,
    };

    // Step 3: Memory exists and NOT stale
    if (memory) {
      const isStale = memory.lastRefreshedAt < akte.geaendert;

      if (!isStale) {
        const existingContent = memory.content as Record<string, unknown>;
        if (existingContent && typeof existingContent.summary === "string") {
          log.debug({ akteId, version: memory.version }, "Memory is fresh, returning existing");
          return {
            content: existingContent as unknown as HelenaMemoryContent,
            refreshed: false,
          };
        }
      }

      // Step 4: Memory exists but stale -- check cooldown
      if (isStale && isOnCooldown(akteId, cooldownMs)) {
        log.debug({ akteId }, "Memory is stale but on cooldown, returning existing");
        const existingContent = memory.content as Record<string, unknown>;
        if (existingContent && typeof existingContent.summary === "string") {
          return {
            content: existingContent as unknown as HelenaMemoryContent,
            refreshed: false,
          };
        }
      }
    }

    // Step 5: Generate new memory
    log.info({ akteId, hasExisting: !!memory }, "Generating new Helena memory");
    const generatedContent = await generateMemory(prisma, akteId);

    // Step 6: Detect changes
    const previousMeta = memory
      ? (memory.content as Record<string, unknown>)?._meta as MemoryMeta | undefined
      : undefined;
    const changes = detectChanges(previousMeta, currentMeta);

    // Step 7: Preserve existing rejectionPatterns
    let rejectionPatterns: unknown[] | undefined;
    if (memory) {
      const existingContent = memory.content as Record<string, unknown>;
      if (Array.isArray(existingContent?.rejectionPatterns)) {
        rejectionPatterns = existingContent.rejectionPatterns;
      }
    }

    // Merge content with _meta and preserved rejectionPatterns
    const mergedContent: Record<string, unknown> = {
      ...generatedContent,
      _meta: currentMeta,
      ...(rejectionPatterns ? { rejectionPatterns } : {}),
    };

    // Step 8: Upsert with version increment
    await prisma.helenaMemory.upsert({
      where: { akteId },
      create: {
        akteId,
        content: mergedContent as Prisma.InputJsonValue,
        lastRefreshedAt: new Date(),
      },
      update: {
        content: mergedContent as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastRefreshedAt: new Date(),
      },
    });

    // Step 9: Update cooldown
    markRefreshed(akteId);

    log.info(
      { akteId, changes, refreshed: true },
      "Helena memory generated and saved",
    );

    // Step 10: Return result
    return {
      content: generatedContent,
      changes,
      refreshed: true,
    };
  } catch (error: unknown) {
    // Never throw from loadOrRefresh -- return existing content if available
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ akteId, error: errMsg }, "Helena memory loadOrRefresh failed");

    // Try to return stale content if it exists
    try {
      const fallback = await prisma.helenaMemory.findUnique({ where: { akteId } });
      if (fallback) {
        const content = fallback.content as Record<string, unknown>;
        if (content && typeof content.summary === "string") {
          return {
            content: content as unknown as HelenaMemoryContent,
            refreshed: false,
          };
        }
      }
    } catch {
      // Ignore fallback errors
    }

    return { content: null, refreshed: false };
  }
}
