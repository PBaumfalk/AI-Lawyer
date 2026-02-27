/**
 * Schriftsatz Pipeline -- Public API
 *
 * Orchestrates the 5-stage deterministic pipeline:
 * 1. Intent Recognition  (recognizeIntent)
 * 2. Slot Filling         (prefillSlotsFromAkte + fillSlots)
 * 3+4. RAG Assembly       (assembleSchriftsatz)
 * 5. ERV Validation       (validateErv)
 * 6. Draft Creation       (prisma.helenaDraft.create)
 *
 * Returns "needs_input" with conversational Rueckfrage when slots are incomplete.
 * Returns "complete" with full SchriftsatzSchema stored as HelenaDraft.meta.
 * Returns "error" with captured error details on failure.
 */

import type { UserRole } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/db";
import type { IntentResult, Schriftsatz, ErvWarnung, RetrievalBeleg } from "./schemas";
import { recognizeIntent, buildAkteContext } from "./intent-router";
import { prefillSlotsFromAkte, fillSlots, type SlotValues } from "./slot-filler";
import { assembleSchriftsatz } from "./rag-assembler";
import { validateErv } from "./erv-validator";
import {
  extractUnresolvedPlatzhalter,
  resolvePlatzhalterInSchema,
} from "./platzhalter";
import { getKlageartDefinition } from "./klageart-registry";
import { SchriftsatzSchema } from "./schemas";
import { notifyDraftCreated } from "@/lib/helena/draft-notification";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchriftsatzPipelineOptions {
  prisma: ExtendedPrismaClient;
  userId: string;
  userRole: UserRole;
  userName: string;
  /** Schriftsatz always requires Akte context */
  akteId: string;
  /** User's natural language request */
  message: string;
  /** Answers to Rueckfragen from previous interactions */
  userSlotValues?: Partial<SlotValues>;
  /** For cooperative cancellation */
  abortSignal?: AbortSignal;
  /** Progress callback */
  onStepUpdate?: (step: { stage: string; detail: string }) => void;
}

export interface SchriftsatzPipelineResult {
  status: "complete" | "needs_input" | "error";
  /** Full validated Schriftsatz (present when status=complete) */
  schriftsatz?: Schriftsatz;
  /** Conversational question to ask the user (present when status=needs_input) */
  rueckfrage?: string;
  /** Current slot state for resuming after Rueckfrage */
  slotState?: SlotValues;
  /** Current intent for resuming */
  intentState?: IntentResult;
  /** HelenaDraft ID if draft was created */
  draftId?: string;
  /** Always present, may be empty */
  warnungen: ErvWarnung[];
  /** Always present, may be empty */
  retrieval_belege: RetrievalBeleg[];
  totalTokens: { prompt: number; completion: number };
}

// ---------------------------------------------------------------------------
// Filing term patterns for intent detection
// ---------------------------------------------------------------------------

const FILING_TERMS = [
  "klage",
  "antrag",
  "berufung",
  "revision",
  "widerspruch",
  "beschwerde",
  "einspruch",
  "erwiderung",
];

const AUSSERGERICHTLICH_TERMS = [
  "abmahnung",
  "kuendigungsschreiben",
  "vergleichsvorschlag",
  "aufforderungsschreiben",
  "unterlassungserklaerung",
  "mahnung",
];

const SCHRIFTSATZ_PATTERNS = [
  /erstelle.*(?:klage|antrag|berufung|schriftsatz|abmahnung)/i,
  /verfasse.*(?:antrag|klage|schriftsatz|berufung|abmahnung)/i,
  /formuliere.*(?:berufung|antrag|klage|schriftsatz)/i,
  /schreibe.*(?:schriftsatz|klage|antrag|abmahnung)/i,
  /entw[iu]rf.*(?:klage|antrag|schriftsatz|berufung)/i,
];

// ---------------------------------------------------------------------------
// Intent Detection (quick heuristic, no LLM)
// ---------------------------------------------------------------------------

/**
 * Quick heuristic check whether a message is a Schriftsatz intent.
 * Used for routing in helena/index.ts before starting the full pipeline.
 *
 * @returns true if the message likely requests a Schriftsatz
 */
export function isSchriftsatzIntent(message: string): boolean {
  const lower = message.toLowerCase();

  // Pattern 1: "schriftsatz" + filing term
  if (lower.includes("schriftsatz")) {
    if (FILING_TERMS.some((t) => lower.includes(t))) return true;
    // "schriftsatz" alone with enough context
    if (lower.length > 20) return true;
  }

  // Pattern 2: Explicit action verbs + filing terms
  if (SCHRIFTSATZ_PATTERNS.some((p) => p.test(lower))) return true;

  // Pattern 3: Aussergerichtlich documents
  if (AUSSERGERICHTLICH_TERMS.some((t) => lower.includes(t))) {
    // Must have an action verb or "erstelle" context
    if (
      /erstell|verfass|formulier|schreib|entwurf|entwirf/i.test(lower) ||
      lower.includes("fuer") ||
      lower.includes("gegen")
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Pipeline Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full 5-stage deterministic Schriftsatz pipeline.
 *
 * Stages:
 * 1. Intent Recognition -> IntentResult
 * 2. Slot Filling -> SlotFillResult (may return needs_input)
 * 3+4. RAG Assembly -> AssemblyResult
 * 5. ERV Validation -> ErvWarnung[]
 * 6. Draft Creation -> HelenaDraft
 */
export async function runSchriftsatzPipeline(
  options: SchriftsatzPipelineOptions,
): Promise<SchriftsatzPipelineResult> {
  const {
    prisma,
    userId,
    akteId,
    message,
    userSlotValues,
    abortSignal,
    onStepUpdate,
  } = options;

  try {
    // -----------------------------------------------------------------
    // Stage 1: Intent Recognition
    // -----------------------------------------------------------------
    if (abortSignal?.aborted) throw new Error("Aborted");
    onStepUpdate?.({ stage: "intent", detail: "Analysiere Anfrage..." });

    const akteContext = await buildAkteContext(prisma, akteId);
    const intent = await recognizeIntent(message, akteContext);

    if (intent.confidence < 0.5) {
      return {
        status: "needs_input",
        rueckfrage:
          "Ich bin mir nicht sicher, was fuer einen Schriftsatz du brauchst. Kannst du genauer beschreiben, was du erstellen moechtest?",
        intentState: intent,
        warnungen: [],
        retrieval_belege: [],
        totalTokens: { prompt: 0, completion: 0 },
      };
    }

    // -----------------------------------------------------------------
    // Stage 2: Slot Filling
    // -----------------------------------------------------------------
    if (abortSignal?.aborted) throw new Error("Aborted");
    onStepUpdate?.({ stage: "slots", detail: "Sammle Informationen..." });

    const prefilled = await prefillSlotsFromAkte(prisma, akteId, intent);
    const slotResult = fillSlots(intent, prefilled, userSlotValues ?? {});

    if (!slotResult.vollstaendig) {
      return {
        status: "needs_input",
        rueckfrage:
          slotResult.rueckfrage ?? "Ich benoetigen weitere Informationen.",
        slotState: slotResult.slots,
        intentState: intent,
        warnungen: [],
        retrieval_belege: [],
        totalTokens: { prompt: 0, completion: 0 },
      };
    }

    // -----------------------------------------------------------------
    // Stage 3+4: RAG Assembly
    // -----------------------------------------------------------------
    if (abortSignal?.aborted) throw new Error("Aborted");
    onStepUpdate?.({ stage: "assembly", detail: "Erstelle Schriftsatz..." });

    const klageartDef = getKlageartDefinition(intent.klageart);
    const assemblyResult = await assembleSchriftsatz(
      intent,
      slotResult.slots,
      klageartDef,
    );

    // -----------------------------------------------------------------
    // Stage 5: ERV Validation
    // -----------------------------------------------------------------
    if (abortSignal?.aborted) throw new Error("Aborted");
    onStepUpdate?.({
      stage: "validation",
      detail: "Pruefe formale Anforderungen...",
    });

    // Parse the assembled object through the Zod schema
    const parseResult = SchriftsatzSchema.safeParse(assemblyResult.schriftsatz);

    let schriftsatz: Schriftsatz;
    if (parseResult.success) {
      schriftsatz = parseResult.data;
    } else {
      // If schema validation fails, build a fallback Schriftsatz
      schriftsatz = assemblyResult.schriftsatz as unknown as Schriftsatz;
    }

    // Resolve remaining placeholders
    schriftsatz = resolvePlatzhalterInSchema(schriftsatz, slotResult.slots);

    // Extract unresolved placeholders
    const unresolvedPlatzhalter = extractUnresolvedPlatzhalter(schriftsatz);

    // Run ERV validation
    const warnungen = validateErv(schriftsatz, klageartDef, slotResult.slots);

    // Update completeness
    const hasKritisch = warnungen.some((w) => w.schwere === "KRITISCH");
    const vollstaendig =
      unresolvedPlatzhalter.length === 0 && !hasKritisch;

    // Update the schriftsatz with validation results
    schriftsatz = {
      ...schriftsatz,
      retrieval_belege: assemblyResult.allBelege,
      unresolved_platzhalter: unresolvedPlatzhalter,
      vollstaendig,
      warnungen: warnungen.map((w) => w.text),
    };

    // -----------------------------------------------------------------
    // Stage 6: Draft Creation
    // -----------------------------------------------------------------
    if (abortSignal?.aborted) throw new Error("Aborted");
    onStepUpdate?.({ stage: "draft", detail: "Erstelle Entwurf..." });

    const markdown = renderSchriftsatzMarkdown(schriftsatz);

    const draft = await prisma.helenaDraft.create({
      data: {
        akteId,
        userId,
        typ: "DOKUMENT",
        status: "PENDING",
        titel: `Schriftsatz: ${klageartDef.label} -- ${intent.stadium}`,
        inhalt: markdown,
        meta: schriftsatz as unknown as Record<string, unknown>,
      },
    });

    // Resolve Akte owner for notification recipients
    const akteForNotify = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { anwaltId: true, sachbearbeiterId: true },
    });
    const akteAnwaltId = akteForNotify?.anwaltId ?? akteForNotify?.sachbearbeiterId ?? null;

    // Fire-and-forget: notification failure must not fail the pipeline
    notifyDraftCreated(
      { id: draft.id, akteId, userId, typ: "DOKUMENT", titel: draft.titel },
      akteAnwaltId,
    ).catch(() => {});

    return {
      status: "complete",
      schriftsatz,
      draftId: draft.id,
      warnungen,
      retrieval_belege: assemblyResult.allBelege,
      totalTokens: assemblyResult.totalTokens,
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : String(error);

    return {
      status: "error",
      warnungen: [
        { typ: "FORM", schwere: "KRITISCH", text: msg },
      ],
      retrieval_belege: [],
      totalTokens: { prompt: 0, completion: 0 },
    };
  }
}

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

/**
 * Render a SchriftsatzSchema as formatted German markdown.
 * Includes ERV validation checklist and source references.
 */
export function renderSchriftsatzMarkdown(schriftsatz: Schriftsatz): string {
  const lines: string[] = [];

  // Rubrum
  lines.push("## Rubrum\n");
  lines.push(`**Gericht:** ${schriftsatz.rubrum.gericht}`);
  if (schriftsatz.rubrum.aktenzeichen) {
    lines.push(`**Aktenzeichen:** ${schriftsatz.rubrum.aktenzeichen}`);
  }
  lines.push("");
  lines.push(
    `**${schriftsatz.rubrum.klaeger.rolle}:** ${schriftsatz.rubrum.klaeger.name}${schriftsatz.rubrum.klaeger.anschrift ? `\n${schriftsatz.rubrum.klaeger.anschrift}` : ""}`,
  );
  if (schriftsatz.rubrum.klaeger.vertreter) {
    lines.push(
      `vertreten durch: ${schriftsatz.rubrum.klaeger.vertreter}`,
    );
  }
  lines.push("");
  lines.push("gegen");
  lines.push("");
  lines.push(
    `**${schriftsatz.rubrum.beklagter.rolle}:** ${schriftsatz.rubrum.beklagter.name}${schriftsatz.rubrum.beklagter.anschrift ? `\n${schriftsatz.rubrum.beklagter.anschrift}` : ""}`,
  );
  if (schriftsatz.rubrum.beklagter.vertreter) {
    lines.push(
      `vertreten durch: ${schriftsatz.rubrum.beklagter.vertreter}`,
    );
  }
  lines.push("");
  lines.push(`**wegen** ${schriftsatz.rubrum.wegen}`);
  if (schriftsatz.rubrum.streitwert) {
    lines.push(
      `\n**Streitwert:** ${schriftsatz.rubrum.streitwert.toLocaleString("de-DE")} EUR`,
    );
  }

  // Antraege
  lines.push("\n## Antraege\n");
  schriftsatz.antraege.forEach((antrag, i) => {
    lines.push(`${i + 1}. ${antrag}`);
  });

  // Sachverhalt
  lines.push("\n## Sachverhalt\n");
  lines.push(schriftsatz.sachverhalt);

  // Rechtliche Wuerdigung
  lines.push("\n## Rechtliche Wuerdigung\n");
  lines.push(schriftsatz.rechtlicheWuerdigung);

  // Beweisangebote
  if (schriftsatz.beweisangebote.length > 0) {
    lines.push("\n## Beweisangebote\n");
    schriftsatz.beweisangebote.forEach((b) => {
      const anlage = b.anlagenNummer ? ` (${b.anlagenNummer})` : "";
      lines.push(`- **${b.behauptung}**`);
      lines.push(`  Beweis: ${b.beweismittel}${anlage}`);
    });
  }

  // Anlagenverzeichnis
  if (schriftsatz.anlagen.length > 0) {
    lines.push("\n## Anlagenverzeichnis\n");
    schriftsatz.anlagen.forEach((a) => {
      lines.push(
        `- **${a.nummer}:** ${a.bezeichnung}${a.dokumentId ? ` (Dok-ID: ${a.dokumentId})` : ""}`,
      );
    });
  }

  // Kosten
  lines.push("\n## Kosten\n");
  if (schriftsatz.kosten.streitwert) {
    lines.push(
      `**Streitwert:** ${schriftsatz.kosten.streitwert.toLocaleString("de-DE")} EUR`,
    );
  }
  if (schriftsatz.kosten.gerichtskosten) {
    lines.push(
      `**Gerichtskosten:** ${schriftsatz.kosten.gerichtskosten.toLocaleString("de-DE")} EUR`,
    );
  }
  schriftsatz.kosten.hinweise.forEach((h) => {
    lines.push(`- ${h}`);
  });

  // Formales
  lines.push("\n## Formales\n");
  lines.push(`**Datum:** ${schriftsatz.formales.datum}`);
  lines.push(`**Unterschrift:** ${schriftsatz.formales.unterschrift}`);
  schriftsatz.formales.hinweise.forEach((h) => {
    lines.push(`- ${h}`);
  });

  // ERV Pruefbericht
  lines.push("\n---\n### Pruefbericht (ERV-Validierung)\n");
  if (schriftsatz.warnungen.length === 0) {
    lines.push("Alle Pruefungen bestanden.");
  } else {
    schriftsatz.warnungen.forEach((w) => {
      // Simple rendering: use warning emoji convention
      lines.push(`- ${w}`);
    });
  }

  // Vollstaendigkeit
  if (!schriftsatz.vollstaendig) {
    lines.push(
      `\n**Achtung:** Entwurf ist noch nicht vollstaendig. ${schriftsatz.unresolved_platzhalter.length} Platzhalter offen.`,
    );
  }

  // Verwendete Quellen
  if (schriftsatz.retrieval_belege.length > 0) {
    lines.push("\n### Verwendete Quellen\n");
    lines.push("<details><summary>Quellen anzeigen</summary>\n");
    schriftsatz.retrieval_belege.forEach((b) => {
      lines.push(
        `- **[${b.quelle}]** ${b.referenz} (Score: ${b.score.toFixed(2)})\n  > ${b.auszug}`,
      );
    });
    lines.push("\n</details>");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { SchriftsatzSchema } from "./schemas";
export type { Schriftsatz, IntentResult, ErvWarnung, RetrievalBeleg } from "./schemas";
export type { SlotValues } from "./slot-filler";
export { getKlageartDefinition } from "./klageart-registry";
export { validateErv } from "./erv-validator";
export { assembleSchriftsatz } from "./rag-assembler";
export { recognizeIntent, buildAkteContext } from "./intent-router";
export { prefillSlotsFromAkte, fillSlots } from "./slot-filler";
export {
  extractUnresolvedPlatzhalter,
  resolvePlatzhalterInSchema,
  PLATZHALTER_MAP,
} from "./platzhalter";
