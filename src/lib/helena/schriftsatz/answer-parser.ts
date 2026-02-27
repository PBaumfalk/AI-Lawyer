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
    prompt: `Du bist ein Intent-Classifier fuer einen Schriftsatz-Workflow. Der Nutzer hat eine offene Rueckfrage:

Aktuelle Rueckfrage: "${pendingRueckfrage}"

Bisherige Angaben: ${JSON.stringify(currentSlots, null, 2)}

Nachricht des Nutzers: "${userMessage}"

Klassifiziere die Nachricht:
- "answer": Der Nutzer beantwortet die Rueckfrage oder liefert die angefragten Informationen
- "correction": Der Nutzer korrigiert eine fruehere Angabe (nenne den Slot-Key in correctedSlotKey, z.B. KLAEGER_NAME)
- "cancel": Der Nutzer moechte abbrechen (z.B. "abbrechen", "stop", "vergiss es", "lass mal")
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
    prompt: `Du bist ein Slot-Extractor fuer einen juristischen Schriftsatz-Workflow.

Gestellte Frage: "${pendingRueckfrage}"

Erwartete Slot-Keys (UPPER_SNAKE_CASE): ${expectedSlotKeys.join(", ")}

Bisherige Angaben: ${JSON.stringify(existingSlots, null, 2)}

Antwort des Nutzers: "${userMessage}"

Extrahiere die Werte aus der Antwort und mappe sie auf die erwarteten Slot-Keys.
- Datumsangaben im Format TT.MM.JJJJ (z.B. "letzten Freitag" -> berechne das Datum)
- Geldbetraege als Zahl (z.B. "dreitausend" -> "3000")
- Wenn der Nutzer "weiss ich noch nicht" oder aehnliches sagt, setze den Wert auf "{{SLOT_KEY}}"
- Nur Keys aus der erwarteten Liste verwenden
- Wenn der Nutzer eine fruehere Angabe korrigiert, auch den korrigierten Slot-Key einbeziehen`,
  });

  return object.extractedValues;
}
