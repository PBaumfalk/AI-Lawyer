/**
 * NER-based PII filter for German legal text.
 *
 * DSGVO gate: no text reaches pgvector without passing through this module.
 * Uses Ollama (qwen3.5:35b) with a few-shot German legal NER prompt plus
 * regex institution whitelist to extract natural person names and flag PII.
 *
 * BRAO §43a compliance:
 * - AbortSignal.timeout(45_000) hard-kills Ollama on non-response
 * - Timeout propagates as thrown error — NEVER returns hasPii: false silently
 * - format:"json" + /\{[\s\S]*\}/ double defense against <think> token leakage
 */

import { createLogger } from "@/lib/logger";
import { isInstitutionName } from "./institution-whitelist";

const log = createLogger("ner-filter");

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const NER_MODEL = "qwen3.5:35b";
const NER_TIMEOUT_MS = 45_000; // BRAO §43a compliance — hard kill, never silent pass

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result returned by runNerFilter().
 */
export interface NerResult {
  /** Full names of natural persons after institution whitelist filter */
  persons: string[];
  /** true if any persons[] remain after filtering */
  hasPii: boolean;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build the few-shot German legal NER prompt for Ollama.
 *
 * Embeds the provided text slice directly into the prompt. The caller is
 * responsible for windowing long texts appropriately:
 * - For UrteilChunk (2000-token child chunks): pass the chunk content directly
 * - For Muster (long PDFs/DOCX): pass `text.slice(0, 6000) + "\n...\n" + text.slice(-2000)`
 *   to cover the Rubrum (person names in header) and signatures (names in footer)
 *
 * The function itself embeds whatever `text` string it receives verbatim.
 *
 * @param text - The German legal text to analyse (caller controls windowing)
 * @returns The complete few-shot NER prompt string ready for Ollama
 */
export function buildNerPrompt(text: string): string {
  return `Du bist ein Datenschutz-Experte fuer deutsche Gerichtsentscheidungen.
Deine Aufgabe: Extrahiere alle vollstaendigen Personennamen natuerlicher Personen aus dem Text.

WICHTIGE REGELN:
- Extrahiere NUR Namen von natuerlichen Personen (Klaeger, Beklagte, Zeugen, einzelne Richter bei Namensnennung)
- NICHT extrahieren: Gerichtsnamen (Bundesgerichtshof, Amtsgericht, Landgericht, BAG, BGH usw.)
- NICHT extrahieren: Behoerden und Institutionen (Bundesministerium, Staatsanwaltschaft usw.)
- NICHT extrahieren: Kammern, Senate, Gremien (2. Senat, 1. Kammer usw.)
- NICHT extrahieren: Firmen und Organisationen
- NICHT extrahieren: Abkuerzungen wie "Kl.", "Bekl.", "Klaegerin"

Antworte AUSSCHLIESSLICH mit folgendem JSON-Format:
{"persons": ["Vollstaendiger Name 1", "Vollstaendiger Name 2"]}
Wenn keine natuerlichen Personen gefunden: {"persons": []}

BEISPIELE:
---
Text: "Die Beklagte, die Bundesrepublik Deutschland, vertreten durch das Bundesministerium der Finanzen, wendet sich gegen die Entscheidung des Bundesarbeitsgerichts vom 12.03.2021."
Antwort: {"persons": []}

Text: "Der Klaeger Hans Mueller, wohnhaft in Koeln, verklagte die Maria Schmidt GmbH vor dem Amtsgericht Koeln."
Antwort: {"persons": ["Hans Mueller"]}

Text: "Richterin Dr. Sabine Hoffmann verlas die Entscheidung des 2. Senats des Bundesgerichtshofs."
Antwort: {"persons": ["Dr. Sabine Hoffmann"]}

Text: "Rechtsanwalt Dr. Klaus Weber vertritt den Klaeger Thomas Fischer gegen die Beklagte, vertreten durch Rechtsanwaeltin Anna Braun."
Antwort: {"persons": ["Dr. Klaus Weber", "Thomas Fischer", "Anna Braun"]}

Text: "Das Landesarbeitsgericht Hamm, Kammer 5, hat unter Vorsitz von Richter am LAG Karl Lehmann entschieden."
Antwort: {"persons": ["Karl Lehmann"]}

Text: "Die Klage wird abgewiesen. Der Klaeger traegt die Kosten. Das Urteil ist vorbehaltlich einer Entscheidung des Bundesverfassungsgerichts vollstreckbar."
Antwort: {"persons": []}
---

Jetzt analysiere folgenden Text:
${text}`;
}

// ─── Core NER filter ──────────────────────────────────────────────────────────

/**
 * Run NER-based PII detection on German legal text using Ollama (qwen3.5:35b).
 *
 * CRITICAL — timeout behaviour (BRAO §43a):
 *   AbortSignal.timeout(45_000) fires if Ollama does not respond within 45 seconds.
 *   The resulting AbortError is NOT caught here — it propagates to the caller.
 *   BullMQ processor must handle the thrown error by resetting state (PENDING_NER)
 *   and re-throwing so BullMQ marks the job failed. Never returns hasPii: false on timeout.
 *
 * Double defense against Qwen3 <think> token leakage:
 *   1. format:"json" — Ollama grammar-constrained decoding prevents non-JSON tokens
 *   2. /\{[\s\S]*\}/ regex extraction — second line of defence if (1) fails
 *
 * @param text - The German legal text to analyse (caller controls windowing/slicing)
 * @returns Promise<NerResult> with persons[] and hasPii flag
 * @throws Error on Ollama HTTP error, no JSON in response, or JSON parse failure
 * @throws AbortError (from AbortSignal.timeout) on Ollama non-response after 45s
 */
export async function runNerFilter(text: string): Promise<NerResult> {
  const prompt = buildNerPrompt(text);

  // POST to Ollama with grammar-constrained JSON output and hard 45s timeout
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NER_MODEL,
      prompt,
      stream: false,
      format: "json",    // Grammar-constrained JSON output — defense 1 against <think> leakage
      temperature: 0,    // Deterministic for compliance
      num_predict: 500,  // Sufficient for a persons[] array
    }),
    signal: AbortSignal.timeout(NER_TIMEOUT_MS), // Hard 45s kill — AbortError propagates
  });

  if (!response.ok) {
    throw new Error(`Ollama NER failed HTTP ${response.status}`);
  }

  const data = (await response.json()) as { response: string };

  // Defense 2: extract JSON object from response text (handles edge-case <think> prefix)
  const jsonMatch = data.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("NER response contained no JSON");
  }

  // Parse the extracted JSON with explicit type narrowing
  let parsed: { persons?: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { persons?: unknown };
  } catch (err) {
    throw new Error(`NER JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Safely extract persons array — LLM may return null or wrong type
  const rawPersons = Array.isArray(parsed.persons)
    ? (parsed.persons as string[]).filter((p) => typeof p === "string")
    : [];

  if (rawPersons.length === 0) {
    log.warn({ textLength: text.length }, "NER returned empty persons array");
  }

  // Apply institution whitelist — remove courts, government bodies, and statutory organs
  const filteredPersons = rawPersons.filter((p) => !isInstitutionName(p));

  log.debug(
    {
      rawCount: rawPersons.length,
      filteredCount: filteredPersons.length,
      removedByWhitelist: rawPersons.length - filteredPersons.length,
    },
    "NER extraction complete"
  );

  return {
    persons: filteredPersons,
    hasPii: filteredPersons.length > 0,
  };
}
