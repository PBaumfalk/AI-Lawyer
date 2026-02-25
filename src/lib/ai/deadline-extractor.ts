/**
 * Structured deadline extraction from legal German text.
 *
 * Uses AI SDK generateObject() with a Zod schema to reliably extract
 * court deadlines, statutory periods, and filing dates from Schriftsaetze.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel, getProviderName, getModelName } from "@/lib/ai/provider";
import { wrapWithTracking } from "@/lib/ai/token-tracker";
import { getHelenaUserId } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:deadline-extractor");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const deadlineSchema = z.object({
  deadlines: z.array(
    z.object({
      beschreibung: z.string(),
      fristtyp: z.enum(["EREIGNISFRIST", "BEGINNFRIST", "UNBESTIMMT"]),
      datum: z.string().nullable(), // ISO date if found
      dauer: z.string().nullable(), // e.g., "2 Wochen", "1 Monat"
      gesetzlicheGrundlage: z.string().nullable(), // e.g., "SS 276 ZPO"
      confidence: z.number().min(0).max(1),
      quellenStelle: z.string(), // excerpt where deadline was found
    })
  ),
});

export type ExtractedDeadline = z.infer<typeof deadlineSchema>["deadlines"][number];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist ein juristischer Assistent, spezialisiert auf die Erkennung von Fristen in deutschen Rechtstexten.

Extrahiere alle Fristen und Termine aus dem folgenden juristischen Text. Suche nach Mustern wie:
- "Frist von X Wochen/Monaten"
- "bis zum DD.MM.YYYY"
- "innerhalb von X Tagen"
- Rechtsmittelfristen (Berufungsfrist, Revisionsfrist, Widerspruchsfrist)
- Stellungnahmefristen
- Klagefristen
- Verjährungsfristen
- Zustellungsfristen
- "binnen X Wochen"
- Nennungen von konkreten Terminen und Verhandlungstagen

Klassifiziere jede Frist als EREIGNISFRIST (beginnt mit einem Ereignis, z.B. Zustellung), BEGINNFRIST (beginnt an einem festen Datum) oder UNBESTIMMT.

Gib die Quellenpassage an, in der die Frist gefunden wurde. Bewerte dein Vertrauen (confidence) realistisch.`;

// ---------------------------------------------------------------------------
// extractDeadlines
// ---------------------------------------------------------------------------

/**
 * Extract deadlines from a legal text using AI structured generation.
 * Filters results by confidence >= 0.6.
 */
export async function extractDeadlines(
  text: string,
  metadata?: { dokumentName?: string; akteId?: string }
): Promise<ExtractedDeadline[]> {
  const model = await getModel();
  const provider = await getProviderName();
  const modelName = await getModelName();
  const helenaId = await getHelenaUserId();

  // Truncate very long texts to stay within token limits
  const truncatedText = text.length > 15000 ? text.slice(0, 15000) + "\n\n[... Text gekuerzt ...]" : text;

  const contextInfo = metadata?.dokumentName
    ? `\n\nDokument: "${metadata.dokumentName}"`
    : "";

  try {
    const result = await generateObject({
      model,
      schema: deadlineSchema,
      system: SYSTEM_PROMPT,
      prompt: `${truncatedText}${contextInfo}`,
    });

    // Track token usage
    if (helenaId) {
      await wrapWithTracking(result, {
        userId: helenaId,
        akteId: metadata?.akteId ?? null,
        funktion: "SCAN",
        provider,
        model: modelName,
      });
    }

    // Filter by confidence threshold
    const filtered = result.object.deadlines.filter((d) => d.confidence >= 0.6);

    log.info(
      {
        total: result.object.deadlines.length,
        filtered: filtered.length,
        dokumentName: metadata?.dokumentName,
      },
      "Deadlines extracted"
    );

    return filtered;
  } catch (err) {
    log.error(
      { err, dokumentName: metadata?.dokumentName },
      "Failed to extract deadlines"
    );
    throw err;
  }
}
