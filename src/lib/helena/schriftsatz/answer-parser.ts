/**
 * Answer Parser -- LLM-based intent classification and slot extraction
 * for multi-turn Schriftsatz Rueckfragen.
 *
 * Two functions:
 * 1. classifyAnswerIntent -- is user message an answer, correction, cancel, or unrelated?
 * 2. extractSlotValues -- parse free-text answer into typed slot values
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

const IntentClassificationSchema = z.object({
  type: z.enum(["answer", "correction", "cancel", "unrelated"]),
  correctedSlotKey: z.string().optional().describe(
    "For corrections: the UPPER_SNAKE_CASE slot key being corrected"
  ),
});

export type AnswerIntent = z.infer<typeof IntentClassificationSchema>;

/**
 * Classify a user message in the context of a pending Rueckfrage.
 *
 * - "answer": User provides the requested information
 * - "correction": User corrects a previously given value
 * - "cancel": User wants to stop (e.g. "abbrechen", "stop", "vergiss es")
 * - "unrelated": Message has nothing to do with the Schriftsatz pipeline
 */
export async function classifyAnswerIntent(
  userMessage: string,
  pendingRueckfrage: string,
  currentSlots: Record<string, unknown>,
): Promise<AnswerIntent> {
  // Fast keyword check for cancellation -- no LLM needed
  const lower = userMessage.toLowerCase().trim();
  if (
    lower === "abbrechen" ||
    lower === "stop" ||
    lower === "vergiss es" ||
    lower === "cancel" ||
    lower === "nein danke"
  ) {
    return { type: "cancel" };
  }

  const model = await getModel();

  const { object } = await generateObject({
    model,
    schema: IntentClassificationSchema,
    prompt: `Du bist ein Intent-Classifier für einen Schriftsatz-Workflow. Der Nutzer hat eine offene Rückfrage:

Aktuelle Rückfrage: "${pendingRueckfrage}"

Bisherige Angaben: ${JSON.stringify(currentSlots, null, 2)}

Nachricht des Nutzers: "${userMessage}"

Klassifiziere die Nachricht:
- "answer": Der Nutzer beantwortet die Rückfrage oder liefert die angefragten Informationen
- "correction": Der Nutzer korrigiert eine frühere Angabe (nenne den Slot-Key in correctedSlotKey, z.B. KLAEGER_NAME)
- "cancel": Der Nutzer möchte abbrechen (z.B. "abbrechen", "stop", "vergiss es", "lass mal")
- "unrelated": Der Nutzer stellt eine komplett andere Frage die nichts mit dem Schriftsatz zu tun hat`,
  });

  return object;
}

// ---------------------------------------------------------------------------
// Slot Value Extraction
// ---------------------------------------------------------------------------

const SlotExtractionSchema = z.object({
  extractedValues: z.record(z.string()).describe(
    "Map of UPPER_SNAKE_CASE slot keys to extracted string values from the user message"
  ),
});

/**
 * Extract slot values from a free-text user answer.
 *
 * Given the pending Rueckfrage context and the user's response, use LLM
 * to extract structured slot values. Handles natural language dates
 * ("letzten Freitag"), names, amounts ("dreitausend"), etc.
 *
 * @param userMessage - The user's free-text answer
 * @param pendingRueckfrage - The question that was asked
 * @param expectedSlotKeys - The UPPER_SNAKE_CASE keys we expect values for
 * @param existingSlots - Already-known slot values (for correction detection)
 * @returns Record of extracted slot key -> value pairs
 */
export async function extractSlotValues(
  userMessage: string,
  pendingRueckfrage: string,
  expectedSlotKeys: string[],
  existingSlots: Record<string, unknown>,
): Promise<Record<string, string>> {
  const model = await getModel();

  const { object } = await generateObject({
    model,
    schema: SlotExtractionSchema,
    prompt: `Du bist ein Slot-Extractor für einen juristischen Schriftsatz-Workflow.

Gestellte Frage: "${pendingRueckfrage}"

Erwartete Slot-Keys (UPPER_SNAKE_CASE): ${expectedSlotKeys.join(", ")}

Bisherige Angaben: ${JSON.stringify(existingSlots, null, 2)}

Antwort des Nutzers: "${userMessage}"

Extrahiere die Werte aus der Antwort und mappe sie auf die erwarteten Slot-Keys.
- Datumsangaben im Format TT.MM.JJJJ (z.B. "letzten Freitag" -> berechne das Datum)
- Geldbeträge als Zahl (z.B. "dreitausend" -> "3000")
- Wenn der Nutzer "weiß ich noch nicht" oder ähnliches sagt, setze den Wert auf "{{SLOT_KEY}}"
- Nur Keys aus der erwarteten Liste verwenden
- Wenn der Nutzer eine frühere Angabe korrigiert, auch den korrigierten Slot-Key einbeziehen`,
  });

  return object.extractedValues;
}

// ---------------------------------------------------------------------------
// Slot Values from the initial request
// ---------------------------------------------------------------------------

/** Slot as the extractor needs it (subset of SlotDefinition). */
export interface AuftragsSlot {
  key: string;
  label: string;
  type: string;
}

/**
 * Extract slot values the user already stated in the request that started the
 * pipeline ("Kündigung vom 03.11.2026, zugegangen am selben Tag, 3.850 EUR brutto").
 * Without this step every such value was asked again as a Rückfrage.
 *
 * Only explicitly stated values are kept: no guesses, no placeholders. Unknown
 * keys are dropped. Errors return {} so the pipeline falls back to Rückfragen.
 */
export async function extractSlotValuesFromAuftrag(
  auftrag: string,
  slots: AuftragsSlot[],
): Promise<Record<string, string>> {
  if (!auftrag.trim() || slots.length === 0) return {};
  const erlaubt = new Set(slots.map((s) => s.key));
  try {
    const model = await getModel();
    const { object } = await generateObject({
      model,
      schema: SlotExtractionSchema,
      prompt: `Du bist ein Slot-Extractor für einen juristischen Schriftsatz-Workflow.

Auftrag der Anwältin bzw. des Anwalts: "${auftrag}"

Mögliche Slots (Key: Bedeutung, Typ):
${slots.map((s) => `- ${s.key}: ${s.label} (${s.type})`).join("\n")}

Übernimm nur Angaben, die im Auftrag ausdrücklich stehen. Rate nichts und leite nichts ab, was nicht dasteht.
- Datumsangaben im Format TT.MM.JJJJ; "am selben Tag" o. Ä. nur, wenn das Bezugsdatum im Auftrag steht
- Geldbeträge als Zahl ohne Währung (z.B. "3.850 EUR brutto" -> "3850")
- Nicht genannte Slots weglassen, keine Platzhalter
- Nur Keys aus der Liste verwenden`,
    });
    const werte: Record<string, string> = {};
    for (const [key, roh] of Object.entries(object.extractedValues ?? {})) {
      const wert = typeof roh === "string" ? roh.trim() : "";
      if (!erlaubt.has(key) || !wert || wert.startsWith("{{")) continue;
      werte[key] = wert;
    }
    return werte;
  } catch {
    return {};
  }
}
