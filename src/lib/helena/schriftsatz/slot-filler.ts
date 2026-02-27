/**
 * Stage 2: Slot Filler — extracts, pre-fills, and validates slot values.
 *
 * The slot filler is a deterministic (no LLM) pipeline stage that:
 * 1. Pre-fills slots from Akte data (Mandant->Klaeger, Gegner->Beklagter)
 * 2. Merges user-provided values over pre-filled values
 * 3. Detects missing required slots
 * 4. Generates conversational Rueckfragen one-at-a-time
 * 5. Handles "weiss ich noch nicht" with {{PLATZHALTER}} markers
 *
 * Rueckfrage cap: max 10 per pipeline run (caller responsibility).
 * All slot keys use {{UPPER_SNAKE_CASE}} convention.
 */

import type { PrismaClient } from "@prisma/client";
import {
  getKlageartDefinition,
  type SlotDefinition,
} from "./klageart-registry";
import type { IntentResult } from "./schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Slot values — keys are UPPER_SNAKE_CASE, values are resolved or null */
export type SlotValues = Record<string, string | number | boolean | null>;

/** Result of the slot-filling stage */
export interface SlotFillResult {
  /** All known values: pre-filled + user-provided + defaults */
  slots: SlotValues;
  /** Required slots that still need values */
  missingRequired: SlotDefinition[];
  /** Conversational question for the FIRST missing slot, or null if complete */
  rueckfrage: string | null;
  /** true only when ALL required slots have non-null, non-placeholder values */
  vollstaendig: boolean;
}

// ---------------------------------------------------------------------------
// Pre-fill from Akte
// ---------------------------------------------------------------------------

/**
 * Pre-fill slot values from Akte data.
 *
 * Maps Akte Beteiligte to the appropriate party slots based on the
 * intent's rolle (KLAEGER/BEKLAGTER). Extracts addresses from
 * kontakt.adressen (first address).
 *
 * @returns Partial SlotValues with source attribution
 */
export async function prefillSlotsFromAkte(
  prisma: PrismaClient,
  akteId: string,
  intent: IntentResult
): Promise<Partial<SlotValues>> {
  const akte = await prisma.akte.findFirst({
    where: { id: akteId },
    include: {
      beteiligte: {
        include: {
          kontakt: {
            include: {
              adressen: true,
            },
          },
        },
      },
    },
  });

  if (!akte) return {};

  const mandant = akte.beteiligte.find((b) => b.rolle === "MANDANT");
  const gegner = akte.beteiligte.find((b) => b.rolle === "GEGNER");
  const gericht = akte.beteiligte.find((b) => b.rolle === "GERICHT");

  const prefilled: Partial<SlotValues> = {};

  // Party mapping based on rolle
  if (intent.rolle === "KLAEGER") {
    // Mandant is the plaintiff
    if (mandant?.kontakt) {
      prefilled["KLAEGER_NAME"] = formatPartyName(mandant.kontakt);
      prefilled["KLAEGER_ADRESSE"] = formatAddress(mandant.kontakt);
      // Also fill generic party slots
      prefilled["PARTEI_A_NAME"] = prefilled["KLAEGER_NAME"];
      prefilled["PARTEI_A_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      // EV-specific
      prefilled["ANTRAGSTELLER_NAME"] = prefilled["KLAEGER_NAME"];
      prefilled["ANTRAGSTELLER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      // Berufung-specific
      prefilled["BERUFUNGSKLAEGER"] = prefilled["KLAEGER_NAME"];
      prefilled["BERUFUNGSKLAEGER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      // Abmahnung-specific
      prefilled["ABSENDER"] = prefilled["KLAEGER_NAME"];
      prefilled["ABSENDER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
    }
    if (gegner?.kontakt) {
      prefilled["BEKLAGTER_NAME"] = formatPartyName(gegner.kontakt);
      prefilled["BEKLAGTER_ADRESSE"] = formatAddress(gegner.kontakt);
      prefilled["PARTEI_B_NAME"] = prefilled["BEKLAGTER_NAME"];
      prefilled["PARTEI_B_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["ANTRAGSGEGNER_NAME"] = prefilled["BEKLAGTER_NAME"];
      prefilled["ANTRAGSGEGNER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["BERUFUNGSBEKLAGTER"] = prefilled["BEKLAGTER_NAME"];
      prefilled["BERUFUNGSBEKLAGTER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["EMPFAENGER"] = prefilled["BEKLAGTER_NAME"];
      prefilled["EMPFAENGER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
    }
  } else {
    // Mandant is the defendant
    if (mandant?.kontakt) {
      prefilled["BEKLAGTER_NAME"] = formatPartyName(mandant.kontakt);
      prefilled["BEKLAGTER_ADRESSE"] = formatAddress(mandant.kontakt);
      prefilled["PARTEI_B_NAME"] = prefilled["BEKLAGTER_NAME"];
      prefilled["PARTEI_B_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["ANTRAGSGEGNER_NAME"] = prefilled["BEKLAGTER_NAME"];
      prefilled["ANTRAGSGEGNER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["BERUFUNGSBEKLAGTER"] = prefilled["BEKLAGTER_NAME"];
      prefilled["BERUFUNGSBEKLAGTER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
      prefilled["EMPFAENGER"] = prefilled["BEKLAGTER_NAME"];
      prefilled["EMPFAENGER_ADRESSE"] = prefilled["BEKLAGTER_ADRESSE"];
    }
    if (gegner?.kontakt) {
      prefilled["KLAEGER_NAME"] = formatPartyName(gegner.kontakt);
      prefilled["KLAEGER_ADRESSE"] = formatAddress(gegner.kontakt);
      prefilled["PARTEI_A_NAME"] = prefilled["KLAEGER_NAME"];
      prefilled["PARTEI_A_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      prefilled["ANTRAGSTELLER_NAME"] = prefilled["KLAEGER_NAME"];
      prefilled["ANTRAGSTELLER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      prefilled["BERUFUNGSKLAEGER"] = prefilled["KLAEGER_NAME"];
      prefilled["BERUFUNGSKLAEGER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
      prefilled["ABSENDER"] = prefilled["KLAEGER_NAME"];
      prefilled["ABSENDER_ADRESSE"] = prefilled["KLAEGER_ADRESSE"];
    }
  }

  // Gericht from Beteiligte
  if (gericht?.kontakt) {
    prefilled["GERICHT"] = formatPartyName(gericht.kontakt);
  }

  // Akte-level data
  if (akte.gegenstandswert) {
    prefilled["STREITWERT"] = Number(akte.gegenstandswert);
  }

  // Aktenzeichen from Akte
  if (akte.aktenzeichen) {
    prefilled["AZ"] = akte.aktenzeichen;
    prefilled["AKTENZEICHEN"] = akte.aktenzeichen;
  }

  return prefilled;
}

// ---------------------------------------------------------------------------
// Slot Filling (pure function — no LLM, no DB)
// ---------------------------------------------------------------------------

/**
 * Fill slots by merging pre-filled and user-provided values, then
 * check completeness against the Klageart's required slots.
 *
 * This is a pure function — no LLM calls, no database access.
 * User-provided values always override pre-filled values.
 *
 * @param intent - Classified intent from the intent router
 * @param prefilled - Slots pre-filled from Akte data
 * @param userProvided - Slots explicitly provided by the user
 * @returns SlotFillResult with merged values, missing slots, and Rueckfrage
 */
export function fillSlots(
  intent: IntentResult,
  prefilled: Partial<SlotValues>,
  userProvided: Partial<SlotValues>
): SlotFillResult {
  const definition = getKlageartDefinition(intent.klageart);

  // Merge: user-provided overrides pre-filled
  const merged: SlotValues = {};
  for (const slot of [...definition.requiredSlots, ...definition.optionalSlots]) {
    const key = slot.key;
    if (userProvided[key] !== undefined && userProvided[key] !== null) {
      merged[key] = userProvided[key]!;
    } else if (prefilled[key] !== undefined && prefilled[key] !== null) {
      merged[key] = prefilled[key]!;
    } else {
      merged[key] = null;
    }
  }

  // Check required slots for completeness
  const missingRequired: SlotDefinition[] = [];
  for (const slot of definition.requiredSlots) {
    const value = merged[slot.key];
    if (value === null || value === undefined) {
      missingRequired.push(slot);
    }
    // Note: {{PLATZHALTER}} values are "filled but unresolved" —
    // they count as filled for the slot loop but mark vollstaendig=false
  }

  // Check if any filled values are placeholders ({{...}})
  const hasPlaceholders = Object.values(merged).some(
    (v) => typeof v === "string" && v.startsWith("{{") && v.endsWith("}}")
  );

  const vollstaendig = missingRequired.length === 0 && !hasPlaceholders;

  // Generate Rueckfrage for the FIRST missing required slot (one-at-a-time)
  let rueckfrage: string | null = null;
  if (missingRequired.length > 0) {
    rueckfrage = generateRueckfrage(missingRequired[0], intent, merged);
  }

  // Add KSchG 3-Wochen-Frist warning if ZUGANG_DATUM is provided
  if (
    intent.klageart === "kschg_klage" &&
    merged["ZUGANG_DATUM"] &&
    typeof merged["ZUGANG_DATUM"] === "string" &&
    !merged["ZUGANG_DATUM"].startsWith("{{")
  ) {
    const fristWarning = checkKschgFrist(merged["ZUGANG_DATUM"]);
    if (fristWarning && rueckfrage) {
      rueckfrage = `${fristWarning}\n\n${rueckfrage}`;
    } else if (fristWarning && !rueckfrage) {
      // All slots filled but we need to warn about the deadline
      rueckfrage = fristWarning;
    }
  }

  return {
    slots: merged,
    missingRequired,
    rueckfrage,
    vollstaendig,
  };
}

// ---------------------------------------------------------------------------
// Rueckfrage Generation
// ---------------------------------------------------------------------------

/**
 * Generate a conversational German question for a missing slot.
 *
 * Context-aware: references the Klageart and existing known information.
 * Hints at expected format for date and currency slots.
 *
 * @param slot - The slot definition to ask about
 * @param intent - The classified intent for context
 * @param existingSlots - Already-known slot values for context enrichment
 * @returns A natural German question string
 */
export function generateRueckfrage(
  slot: SlotDefinition,
  intent: IntentResult,
  existingSlots: SlotValues
): string {
  const definition = getKlageartDefinition(intent.klageart);
  const klageLabel = definition.label;

  // Build context from existing slots
  const contextParts: string[] = [];
  if (existingSlots["KLAEGER_NAME"] || existingSlots["PARTEI_A_NAME"]) {
    contextParts.push(
      `Klaeger: ${existingSlots["KLAEGER_NAME"] || existingSlots["PARTEI_A_NAME"]}`
    );
  }
  if (existingSlots["BEKLAGTER_NAME"] || existingSlots["PARTEI_B_NAME"]) {
    contextParts.push(
      `Beklagter: ${existingSlots["BEKLAGTER_NAME"] || existingSlots["PARTEI_B_NAME"]}`
    );
  }

  // Format hint based on slot type
  let formatHint = "";
  if (slot.type === "date") {
    formatHint = " (Bitte im Format TT.MM.JJJJ angeben)";
  } else if (slot.type === "currency") {
    formatHint = " (Betrag in EUR)";
  } else if (slot.type === "number") {
    formatHint = " (Zahl)";
  }

  // Generate context-aware question
  const question = buildQuestion(slot, klageLabel);

  // Add context if available
  const context =
    contextParts.length > 0
      ? `\n\nBereits bekannt: ${contextParts.join(", ")}`
      : "";

  return `${question}${formatHint}${context}\n\n_Falls Sie diese Information gerade nicht zur Hand haben, koennen Sie "weiss ich noch nicht" antworten. Der Entwurf wird dann mit einem Platzhalter erstellt._`;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Build a natural German question for a specific slot.
 */
function buildQuestion(slot: SlotDefinition, klageLabel: string): string {
  // Specific questions for well-known slots
  const specificQuestions: Record<string, string> = {
    KUENDIGUNGSDATUM: `Fuer die ${klageLabel}: Wann wurde die Kuendigung ausgesprochen?`,
    ZUGANG_DATUM: `Wann ist Ihrem Mandanten die Kuendigung zugegangen? Das ist wichtig fuer die 3-Wochen-Frist nach SS 4 KSchG.`,
    EINTRITTSDATUM: `Seit wann ist Ihr Mandant bei dem Arbeitgeber beschaeftigt?`,
    BRUTTOGEHALT: `Wie hoch ist das monatliche Bruttogehalt Ihres Mandanten?`,
    BERUFSBEZEICHNUNG: `Welche Taetigkeit / Berufsbezeichnung hat Ihr Mandant?`,
    KUENDIGUNGSART: `Handelt es sich um eine ordentliche, ausserordentliche oder fristlose Kuendigung?`,
    ZEITRAUM_VON: `Fuer die ${klageLabel}: Ab welchem Monat steht das Gehalt aus?`,
    ZEITRAUM_BIS: `Bis zu welchem Monat steht das Gehalt aus?`,
    MONATSBETRAG: `Wie hoch ist das monatliche Bruttogehalt?`,
    ZAHLUNGSGRUND: `Woraus ergibt sich der Zahlungsanspruch? (z.B. Arbeitsvertrag vom..., Tarifvertrag, etc.)`,
    VERFUEGUNGSANSPRUCH: `Fuer den Eilantrag: Welches Recht wird verletzt? (Verfuegungsanspruch)`,
    VERFUEGUNGSGRUND: `Warum ist die Sache eilbeduertig? (Verfuegungsgrund)`,
    KLAGE_DATUM: `Wann ist die Klageschrift datiert?`,
    URTEIL_DATUM: `Wann wurde das angefochtene Urteil verkuendet?`,
    URTEIL_AZ: `Welches Aktenzeichen hat das angefochtene Urteil?`,
    BERUFUNGSGRUENDE: `Was sind die wesentlichen Gruende fuer die Berufung?`,
    VERSTOSS: `Welcher Verstoss wird abgemahnt? Bitte beschreiben Sie den Sachverhalt.`,
    FRIST: `Welche Frist soll fuer die Unterlassung / Abhilfe gesetzt werden?`,
    BETREFF: `Was ist der Gegenstand des Schriftsatzes?`,
  };

  if (specificQuestions[slot.key]) {
    return specificQuestions[slot.key];
  }

  // Generic fallback: use the slot label
  return `Fuer die ${klageLabel} benoetigen wir noch folgende Information: ${slot.label}`;
}

/**
 * Check the KSchG 3-Wochen-Frist (SS 4 KSchG).
 *
 * Uses date-only strings (YYYY-MM-DD or DD.MM.YYYY) to avoid timezone issues.
 * Calculates: Zugang + 21 calendar days.
 *
 * @returns Warning string if deadline is approaching or expired, null otherwise
 */
function checkKschgFrist(zugangDatum: string): string | null {
  const parsed = parseGermanDate(zugangDatum);
  if (!parsed) return null;

  // Calculate deadline: Zugang + 21 calendar days
  const fristEnde = new Date(parsed);
  fristEnde.setDate(fristEnde.getDate() + 21);

  const today = new Date();
  // Compare date-only (avoid timezone issues)
  today.setHours(0, 0, 0, 0);
  fristEnde.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (fristEnde.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const fristFormatted = formatGermanDate(fristEnde);

  if (daysRemaining < 0) {
    return `ACHTUNG: Die 3-Wochen-Frist nach SS 4 KSchG ist bereits am ${fristFormatted} abgelaufen! Die Klage muss trotzdem eingereicht werden — eine nachtraegliche Zulassung nach SS 5 KSchG ist moeglich, aber die Voraussetzungen sind streng.`;
  }

  if (daysRemaining <= 3) {
    return `DRINGEND: Die 3-Wochen-Frist nach SS 4 KSchG endet am ${fristFormatted} — nur noch ${daysRemaining} Tag(e)! Die Klage muss spaetestens an diesem Tag bei Gericht eingehen.`;
  }

  if (daysRemaining <= 7) {
    return `Hinweis: Die 3-Wochen-Frist nach SS 4 KSchG endet am ${fristFormatted} (noch ${daysRemaining} Tage). Bitte rechtzeitig einreichen.`;
  }

  return null;
}

/**
 * Parse a German date string (DD.MM.YYYY or YYYY-MM-DD) to a Date object.
 * Returns null if the format is not recognized.
 */
function parseGermanDate(dateStr: string): Date | null {
  // Try DD.MM.YYYY
  const germanMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return null;
}

/**
 * Format a Date as German date string (DD.MM.YYYY).
 */
function formatGermanDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format a Kontakt as party name (natural person or legal entity).
 */
function formatPartyName(kontakt: {
  vorname?: string | null;
  nachname?: string | null;
  firma?: string | null;
  titel?: string | null;
}): string {
  if (kontakt.firma) {
    return kontakt.firma;
  }

  const parts: string[] = [];
  if (kontakt.titel) parts.push(kontakt.titel);
  if (kontakt.vorname) parts.push(kontakt.vorname);
  if (kontakt.nachname) parts.push(kontakt.nachname);

  return parts.join(" ") || "Unbekannt";
}

/**
 * Format a Kontakt's address from the adressen relation.
 * Uses the first address (or istHaupt=true address if available).
 */
function formatAddress(kontakt: {
  adressen?: Array<{
    strasse?: string | null;
    hausnummer?: string | null;
    plz?: string | null;
    ort?: string | null;
    istHaupt?: boolean;
  }>;
  // Legacy address fields
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
}): string | null {
  // Try adressen relation first
  if (kontakt.adressen && kontakt.adressen.length > 0) {
    const addr =
      kontakt.adressen.find((a) => a.istHaupt) || kontakt.adressen[0];
    const parts: string[] = [];
    if (addr.strasse) {
      parts.push(
        addr.hausnummer ? `${addr.strasse} ${addr.hausnummer}` : addr.strasse
      );
    }
    if (addr.plz || addr.ort) {
      parts.push([addr.plz, addr.ort].filter(Boolean).join(" "));
    }
    return parts.length > 0 ? parts.join(", ") : null;
  }

  // Fallback to legacy address fields
  const parts: string[] = [];
  if (kontakt.strasse) parts.push(kontakt.strasse);
  if (kontakt.plz || kontakt.ort) {
    parts.push([kontakt.plz, kontakt.ort].filter(Boolean).join(" "));
  }

  return parts.length > 0 ? parts.join(", ") : null;
}
