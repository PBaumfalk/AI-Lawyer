/**
 * Central prompt templates for AI task processing.
 *
 * All prompt templates for ai:-tagged tasks are defined here.
 * Templates are functions that accept task + case context and return
 * the complete prompt string + generation parameters.
 *
 * Supported actions: summary, draft, check, monitor, auto
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptTemplateInput {
  /** Ticket title */
  titel: string;
  /** Ticket description (optional) */
  beschreibung?: string | null;
  /** Assembled case context string (Akte metadata, docs, parties) */
  caseContext: string;
}

export interface PromptTemplate {
  /** System prompt sent as system instruction to the LLM */
  system: string;
  /** User prompt with task + context */
  prompt: string;
  /** Temperature (lower = more deterministic) */
  temperature: number;
  /** Max output tokens */
  maxTokens: number;
}

/** Tag → action mapping */
export type AiAction = "summary" | "draft" | "check" | "monitor" | "auto";

// ---------------------------------------------------------------------------
// System Prompt (shared across all actions)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT_DE = `Du bist ein juristischer KI-Assistent für eine deutsche Anwaltskanzlei.
Antworte immer auf Deutsch. Sei präzise und fachlich korrekt.
Verwende juristische Fachbegriffe angemessen.
Du erstellst nur Entwürfe — diese werden IMMER von einem Anwalt geprüft, bevor sie verwendet werden.
Gib keine Rechtsberatung im Sinne des RDG. Deine Ausgaben dienen ausschließlich der internen Vorbereitung.`;

// ---------------------------------------------------------------------------
// Template Builders
// ---------------------------------------------------------------------------

function taskHeader(input: PromptTemplateInput): string {
  let header = `Aufgabe: ${input.titel}`;
  if (input.beschreibung) {
    header += `\nBeschreibung: ${input.beschreibung}`;
  }
  if (input.caseContext) {
    header += `\n\nAktenkontext:\n${input.caseContext}`;
  }
  return header;
}

// ---------------------------------------------------------------------------
// summary — Strukturierte Aktenzusammenfassung
// ---------------------------------------------------------------------------

function buildSummaryPrompt(input: PromptTemplateInput): PromptTemplate {
  return {
    system: SYSTEM_PROMPT_DE,
    prompt: `Erstelle eine strukturierte Zusammenfassung der folgenden Akte.

${taskHeader(input)}

Erstelle eine Zusammenfassung mit folgenden Abschnitten:
1. Sachverhalt (kurz)
2. Beteiligte Parteien
3. Aktuelle Situation / offene Punkte
4. Fristen und Termine (falls erkennbar)
5. Empfohlene nächste Schritte`,
    temperature: 0.2,
    maxTokens: 2000,
  };
}

// ---------------------------------------------------------------------------
// draft — Schriftsatz-/Dokumententwurf
// ---------------------------------------------------------------------------

function buildDraftPrompt(input: PromptTemplateInput): PromptTemplate {
  return {
    system: SYSTEM_PROMPT_DE,
    prompt: `Erstelle einen Entwurf basierend auf der folgenden Aufgabe.

${taskHeader(input)}

WICHTIG: Dies ist ein ENTWURF, der von einem Anwalt geprüft und ggf. angepasst wird.
Erstelle einen professionellen, juristisch korrekten Entwurf.
Verwende eine formelle Sprache und die übliche Struktur für juristische Schriftsätze.
Markiere Stellen, die noch ergänzt oder geprüft werden müssen, mit [TODO: …].`,
    temperature: 0.3,
    maxTokens: 3000,
  };
}

// ---------------------------------------------------------------------------
// check — Vorgang prüfen (Fristen, Vollständigkeit, Risiken)
// ---------------------------------------------------------------------------

function buildCheckPrompt(input: PromptTemplateInput): PromptTemplate {
  return {
    system: SYSTEM_PROMPT_DE,
    prompt: `Prüfe den folgenden Vorgang auf Vollständigkeit, Risiken und offene Punkte.

${taskHeader(input)}

Erstelle einen Prüfbericht mit folgenden Abschnitten:
1. Vollständigkeit — Fehlen wesentliche Unterlagen oder Informationen?
2. Fristen — Sind relevante Fristen erkennbar? Droht Fristversäumnis?
3. Risiken — Welche rechtlichen oder taktischen Risiken bestehen?
4. Handlungsbedarf — Welche konkreten Schritte sind zeitnah erforderlich?

Bewerte jedes Risiko als: NIEDRIG / MITTEL / HOCH.
Sei konservativ bei der Risikobewertung — im Zweifel lieber zu hoch als zu niedrig.`,
    temperature: 0.2,
    maxTokens: 2500,
  };
}

// ---------------------------------------------------------------------------
// monitor — Vorgang überwachen (Statusbericht, Veränderungen)
// ---------------------------------------------------------------------------

function buildMonitorPrompt(input: PromptTemplateInput): PromptTemplate {
  return {
    system: SYSTEM_PROMPT_DE,
    prompt: `Erstelle einen Statusbericht für den folgenden Vorgang.

${taskHeader(input)}

Erstelle einen kurzen Statusbericht mit folgenden Abschnitten:
1. Aktueller Stand — Was ist der derzeitige Status des Vorgangs?
2. Letzte Aktivitäten — Welche relevanten Dokumente oder Ereignisse gibt es?
3. Anstehende Fristen — Welche Termine oder Fristen stehen bevor?
4. Empfehlung — Ist eine Aktion erforderlich oder kann abgewartet werden?

Halte den Bericht kurz und fokussiert. Nur relevante Veränderungen hervorheben.`,
    temperature: 0.2,
    maxTokens: 1500,
  };
}

// ---------------------------------------------------------------------------
// auto — KI bestimmt die passende Aktion
// ---------------------------------------------------------------------------

function buildAutoPrompt(input: PromptTemplateInput): PromptTemplate {
  return {
    system: SYSTEM_PROMPT_DE,
    prompt: `Analysiere die folgende Aufgabe und bearbeite sie bestmöglich.

${taskHeader(input)}

Bestimme selbst, ob eine Zusammenfassung, ein Entwurf, eine Prüfung oder eine Analyse am sinnvollsten ist.
Beginne deine Antwort mit einer kurzen Einordnung, welche Art von Ergebnis du erstellst und warum.
Erstelle dann das passende Ergebnis.`,
    temperature: 0.3,
    maxTokens: 3000,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const TEMPLATE_BUILDERS: Record<
  AiAction,
  (input: PromptTemplateInput) => PromptTemplate
> = {
  summary: buildSummaryPrompt,
  draft: buildDraftPrompt,
  check: buildCheckPrompt,
  monitor: buildMonitorPrompt,
  auto: buildAutoPrompt,
};

/**
 * Map an ai: tag to its action key.
 * Returns undefined for unknown tags.
 */
export function tagToAction(tag: string): AiAction | undefined {
  const map: Record<string, AiAction> = {
    "ai:summary": "summary",
    "ai:draft": "draft",
    "ai:check": "check",
    "ai:monitor": "monitor",
    "ai:auto": "auto",
  };
  return map[tag];
}

/**
 * Build a prompt template for a given action and input.
 * Falls back to "summary" for unknown actions.
 */
export function buildPrompt(
  action: AiAction,
  input: PromptTemplateInput
): PromptTemplate {
  const builder = TEMPLATE_BUILDERS[action] ?? TEMPLATE_BUILDERS.summary;
  return builder(input);
}

/**
 * Label for ChatNachricht prefix based on action.
 */
export function actionLabel(action: AiAction): string {
  const labels: Record<AiAction, string> = {
    summary: "Zusammenfassung",
    draft: "Entwurf",
    check: "Prüfbericht",
    monitor: "Statusbericht",
    auto: "Analyse",
  };
  return labels[action] ?? "Ergebnis";
}
