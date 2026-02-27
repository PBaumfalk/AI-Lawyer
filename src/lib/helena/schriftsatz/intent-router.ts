/**
 * Stage 1: Intent Router — recognizes the user's filing intent.
 *
 * Uses AI SDK generateObject with IntentResultSchema to classify:
 * - Rechtsgebiet (area of law)
 * - Klageart (specific filing type)
 * - Stadium (procedural stage)
 * - Rolle (plaintiff or defendant)
 * - Gerichtszweig (court branch)
 *
 * Enriches classification with Akte context when available.
 */

import { generateObject } from "ai";
import type { PrismaClient } from "@prisma/client";
import { getModelForTier } from "../complexity-classifier";
import { IntentResultSchema } from "./schemas";
import type { IntentResult } from "./schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Condensed Akte context for intent classification */
export interface AkteContext {
  akteId: string;
  sachgebiet: string | null;
  kurzrubrum: string | null;
  beteiligte: Array<{ rolle: string; name: string }>;
  gegenstandswert: number | null;
  dokumente: Array<{ name: string; tags: string[] }>;
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const INTENT_ROUTER_SYSTEM_PROMPT = `Du bist ein juristischer Klassifikator fuer deutsche Schriftsaetze.

Deine Aufgabe: Erkenne aus der Nutzeranfrage und dem Akte-Kontext welcher Schriftsatz erstellt werden soll.

KLASSIFIZIERE:

1. **Rechtsgebiet** — Eines von: ARBEITSRECHT, FAMILIENRECHT, VERKEHRSRECHT, MIETRECHT, STRAFRECHT, ERBRECHT, SOZIALRECHT, INKASSO, HANDELSRECHT, VERWALTUNGSRECHT, SONSTIGES
   - Nutze den Akte-Kontext (sachgebiet) als starkes Signal
   - Bei Widerspruch zwischen Anfrage und Akte: Anfrage hat Vorrang

2. **Klageart** — Spezifischer Typ des Schriftsatzes:
   - "kschg_klage" = Kuendigungsschutzklage (Stichworte: Kuendigung, gekuendigt, Kuendigungsschutz, KSchG)
   - "lohnklage" = Lohn-/Gehaltsklage (Stichworte: Lohn, Gehalt, nicht bezahlt, ausstehendes Gehalt)
   - "ev_antrag" = Einstweilige Verfuegung (Stichworte: einstweilig, Eilantrag, Verfuegung, sofort)
   - "klageerwiderung" = Klageerwiderung (Stichworte: Erwiderung, verteidigen, Klage abweisen)
   - "berufung" = Berufung (Stichworte: Berufung, anfechten, Urteil falsch)
   - "abmahnung" = Abmahnung (Stichworte: Abmahnung, abmahnen, Unterlassung, Verstoesst)
   - "generic" = Wenn kein spezifischer Typ passt

3. **Stadium** — Verfahrensstadium:
   - ERSTINSTANZ: Neue Klage, erste Instanz
   - BERUFUNG: Gegen Urteil erster Instanz
   - REVISION: Gegen Berufungsurteil (selten)
   - BESCHWERDE: Gegen Beschluss
   - EV: Einstweilige Verfuegung / Eilverfahren
   - AUSSERGERICHTLICH: Abmahnungen, Kuendigungsschreiben, Vergleichsvorschlaege, Aufforderungsschreiben

4. **Rolle** — Parteistellung des Mandanten:
   - KLAEGER: Wir klagen / stellen Antrag
   - BEKLAGTER: Wir verteidigen / erwidern

5. **Gerichtszweig** — Automatisch ableiten:
   - ARBEITSRECHT -> ARBG (bzw. LAG bei Berufung, BAG bei Revision)
   - FAMILIENRECHT -> AG (bzw. OLG bei Beschwerde)
   - VERWALTUNGSRECHT -> VG
   - SOZIALRECHT -> SG
   - STRAFRECHT/HANDELSRECHT -> LG
   - MIETRECHT -> AG
   - SONSTIGES -> AG
   - Immer die ERSTE Instanz des Gerichtszweigs, ausser Stadium sagt etwas anderes

6. **Gericht** — Konkretes Gericht, wenn aus Akte oder Anfrage ableitbar (z.B. "Arbeitsgericht Berlin")

7. **Confidence** — Wie sicher bist du? (0.0 - 1.0)
   - >= 0.9: Eindeutig erkannt
   - 0.7 - 0.9: Wahrscheinlich korrekt
   - < 0.7: Unsicher, Nutzer sollte bestaetigen

8. **Begruendung** — Kurze deutsche Erklaerung, warum du so klassifiziert hast

REGELN:
- Wenn Sachgebiet aus Akte bekannt: stark bevorzugen
- Bei "aussergerichtlich", "Abmahnung", "Kuendigungsschreiben", "Vergleichsvorschlag", "Aufforderungsschreiben": Stadium = AUSSERGERICHTLICH
- Bei mehrdeutiger Anfrage: niedrigere Confidence setzen
- Klageart "generic" nur wenn wirklich kein spezifischer Typ passt`;

// ---------------------------------------------------------------------------
// Intent Recognition
// ---------------------------------------------------------------------------

/**
 * Recognize the user's filing intent from a natural language message.
 *
 * Uses tier 3 model (cloud, highest quality) for reliable classification.
 * Enriches classification with Akte context when available.
 *
 * @param userMessage - Natural language message from the user
 * @param akteContext - Condensed Akte data for context enrichment
 * @returns Parsed IntentResult with classification and confidence
 * @throws Error if generateObject fails (pipeline should handle gracefully)
 */
export async function recognizeIntent(
  userMessage: string,
  akteContext: AkteContext | null
): Promise<IntentResult> {
  const { model } = await getModelForTier(3);

  // Build context block from Akte data
  const contextBlock = akteContext
    ? `\n\nAkte-Kontext:\n- Sachgebiet: ${akteContext.sachgebiet ?? "unbekannt"}\n- Kurzrubrum: ${akteContext.kurzrubrum ?? "unbekannt"}\n- Beteiligte: ${akteContext.beteiligte.map((b) => `${b.rolle}: ${b.name}`).join(", ") || "keine"}\n- Gegenstandswert: ${akteContext.gegenstandswert ? `${akteContext.gegenstandswert} EUR` : "unbekannt"}`
    : "";

  const result = await generateObject({
    model,
    schema: IntentResultSchema,
    system: INTENT_ROUTER_SYSTEM_PROMPT,
    prompt: `${userMessage}${contextBlock}`,
  });

  return result.object;
}

// ---------------------------------------------------------------------------
// Akte Context Builder
// ---------------------------------------------------------------------------

/**
 * Build a condensed AkteContext from Prisma data.
 *
 * Queries the Akte with beteiligte (including kontakt) and dokumente
 * to provide context for intent classification.
 *
 * @returns AkteContext or null if the Akte is not found
 */
export async function buildAkteContext(
  prisma: PrismaClient,
  akteId: string
): Promise<AkteContext | null> {
  const akte = await prisma.akte.findFirst({
    where: { id: akteId },
    include: {
      beteiligte: {
        include: {
          kontakt: true,
        },
      },
      dokumente: {
        select: { name: true, tags: true },
        take: 20, // Limit to avoid context overflow
      },
    },
  });

  if (!akte) return null;

  return {
    akteId: akte.id,
    sachgebiet: akte.sachgebiet,
    kurzrubrum: akte.kurzrubrum,
    beteiligte: akte.beteiligte.map((b) => ({
      rolle: b.rolle,
      name: formatKontaktName(b.kontakt),
    })),
    gegenstandswert: akte.gegenstandswert
      ? Number(akte.gegenstandswert)
      : null,
    dokumente: akte.dokumente.map((d) => ({
      name: d.name,
      tags: d.tags,
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a Kontakt name for display (natural person or legal entity).
 */
function formatKontaktName(kontakt: {
  vorname?: string | null;
  nachname?: string | null;
  firma?: string | null;
  titel?: string | null;
}): string {
  // Legal entity
  if (kontakt.firma) {
    return kontakt.firma;
  }

  // Natural person
  const parts: string[] = [];
  if (kontakt.titel) parts.push(kontakt.titel);
  if (kontakt.vorname) parts.push(kontakt.vorname);
  if (kontakt.nachname) parts.push(kontakt.nachname);

  return parts.join(" ") || "Unbekannt";
}
