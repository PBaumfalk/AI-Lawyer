/**
 * Structured party extraction from legal German text.
 *
 * Uses AI SDK generateObject() with a Zod schema to reliably extract
 * involved parties (Beteiligte) from court documents.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getModel, getProviderName, getModelName } from "@/lib/ai/provider";
import { wrapWithTracking } from "@/lib/ai/token-tracker";
import { getHelenaUserId } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:party-extractor");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const partySchema = z.object({
  parties: z.array(
    z.object({
      name: z.string(),
      rolle: z.enum([
        "KLAEGER",
        "BEKLAGTER",
        "ZEUGE",
        "RICHTER",
        "ANWALT",
        "SACHVERSTAENDIGER",
        "BEHOERDE",
        "SONSTIG",
      ]),
      typ: z.enum(["NATUERLICH", "JURISTISCH"]),
      adresse: z.string().nullable(),
      aktenzeichen: z.string().nullable(), // court case number if mentioned
      confidence: z.number().min(0).max(1),
    })
  ),
});

export type ExtractedParty = z.infer<typeof partySchema>["parties"][number];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist ein juristischer Assistent, spezialisiert auf die Erkennung von Parteien und Beteiligten in deutschen Rechtstexten.

Extrahiere alle Parteien und Beteiligten aus dem folgenden juristischen Text. Suche nach:
- Klaeger und Beklagte (auch "Antragsteller" / "Antragsgegner")
- Rechtsanwaelte und Prozessbevollmaechtigte
- Richter und Vorsitzende
- Zeugen und Sachverstaendige
- Behoerden und Gerichte
- Sonstige genannte Personen und Organisationen

Klassifiziere jede Partei nach ihrer Rolle und ob es sich um eine natuerliche oder juristische Person handelt.
Extrahiere wenn moeglich auch die Adresse und das Aktenzeichen.
Bewerte dein Vertrauen (confidence) realistisch.`;

// ---------------------------------------------------------------------------
// extractParties
// ---------------------------------------------------------------------------

/**
 * Extract parties from a legal text using AI structured generation.
 * Filters results by confidence >= 0.6.
 */
export async function extractParties(
  text: string,
  metadata?: { dokumentName?: string; akteId?: string }
): Promise<ExtractedParty[]> {
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
      schema: partySchema,
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
    const filtered = result.object.parties.filter((p) => p.confidence >= 0.6);

    log.info(
      {
        total: result.object.parties.length,
        filtered: filtered.length,
        dokumentName: metadata?.dokumentName,
      },
      "Parties extracted"
    );

    return filtered;
  } catch (err) {
    log.error(
      { err, dokumentName: metadata?.dokumentName },
      "Failed to extract parties"
    );
    throw err;
  }
}
