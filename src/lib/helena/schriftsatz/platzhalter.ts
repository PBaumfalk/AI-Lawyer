/**
 * Unified placeholder standard for the Schriftsatz pipeline.
 *
 * All Schriftsatz output uses {{UPPER_SNAKE_CASE}} placeholders.
 * This module provides:
 * - PLATZHALTER_MAP: mapping from UPPER_SNAKE_CASE to dotted.key (Vorlagen convention)
 * - extractUnresolvedPlatzhalter: find all unresolved {{...}} in an object
 * - resolvePlatzhalterInSchema: substitute {{SLOT_KEY}} with slot values
 * - toDottedKey / toUpperSnake: format conversion utilities
 */

import type { Schriftsatz } from "./schemas";
import type { SlotValues } from "./slot-filler";

// ---------------------------------------------------------------------------
// Mapping: UPPER_SNAKE_CASE <-> dotted.key
// ---------------------------------------------------------------------------

/**
 * Maps from {{UPPER_SNAKE_CASE}} (Schriftsatz convention) to dotted.key
 * (Vorlagen convention) for all common fields.
 */
export const PLATZHALTER_MAP: Record<string, string> = {
  // Party fields
  KLAEGER_NAME: "mandant.name",
  KLAEGER_ADRESSE: "mandant.adresse",
  BEKLAGTER_NAME: "gegner.name",
  BEKLAGTER_ADRESSE: "gegner.adresse",

  // Generic party aliases
  PARTEI_A_NAME: "mandant.name",
  PARTEI_A_ADRESSE: "mandant.adresse",
  PARTEI_B_NAME: "gegner.name",
  PARTEI_B_ADRESSE: "gegner.adresse",

  // EV-specific aliases
  ANTRAGSTELLER_NAME: "mandant.name",
  ANTRAGSTELLER_ADRESSE: "mandant.adresse",
  ANTRAGSGEGNER_NAME: "gegner.name",
  ANTRAGSGEGNER_ADRESSE: "gegner.adresse",

  // Berufung aliases
  BERUFUNGSKLAEGER: "mandant.name",
  BERUFUNGSKLAEGER_ADRESSE: "mandant.adresse",
  BERUFUNGSBEKLAGTER: "gegner.name",
  BERUFUNGSBEKLAGTER_ADRESSE: "gegner.adresse",

  // Abmahnung aliases
  ABSENDER: "mandant.name",
  ABSENDER_ADRESSE: "mandant.adresse",
  EMPFAENGER: "gegner.name",
  EMPFAENGER_ADRESSE: "gegner.adresse",

  // Court and case
  GERICHT: "gericht.name",
  AKTENZEICHEN: "akte.aktenzeichen",
  AZ: "akte.aktenzeichen",
  STREITWERT: "akte.gegenstandswert",
  STREITWERT_EUR: "akte.gegenstandswert",

  // Lawyer / firm
  RA_NAME: "anwalt.name",
  RA_KANZLEI: "kanzlei.name",
  RA_ADRESSE: "kanzlei.adresse",

  // Date
  DATUM: "datum.heute",

  // KSchG specific
  KUENDIGUNGSDATUM: "akte.kuendigungsdatum",
  ZUGANG_DATUM: "akte.zugangsdatum",
  EINTRITTSDATUM: "akte.eintrittsdatum",
  BRUTTOGEHALT: "akte.bruttogehalt",
  BERUFSBEZEICHNUNG: "akte.berufsbezeichnung",
  KUENDIGUNGSART: "akte.kuendigungsart",
  KUENDIGUNGSGRUND: "akte.kuendigungsgrund",
  BETRIEBSRAT_ANHOERUNG: "akte.betriebsrat_anhoerung",
  BETRIEBSGROESSE: "akte.betriebsgroesse",
  SONDERKUENDIGUNGSSCHUTZ: "akte.sonderkuendigungsschutz",
  WEITERBESCHAEFTIGUNG: "akte.weiterbeschaeftigung",

  // Lohnklage specific
  ZEITRAUM_VON: "akte.zeitraum_von",
  ZEITRAUM_BIS: "akte.zeitraum_bis",
  MONATSBETRAG: "akte.monatsbetrag",
  ZAHLUNGSGRUND: "akte.zahlungsgrund",
  AUSSTEHENDE_SUMME: "akte.ausstehende_summe",
  VERZUGSZINSEN: "akte.verzugszinsen",
  ABRECHNUNG_VERLANGT: "akte.abrechnung_verlangt",
  MAHNUNG_DATUM: "akte.mahnung_datum",

  // EV specific
  VERFUEGUNGSANSPRUCH: "akte.verfuegungsanspruch",
  VERFUEGUNGSGRUND: "akte.verfuegungsgrund",
  GLAUBHAFTMACHUNG: "akte.glaubhaftmachung",

  // Klageerwiderung specific
  KLAGE_DATUM: "akte.klage_datum",
  KLAGE_ZUSAMMENFASSUNG: "akte.klage_zusammenfassung",
  ERWIDERUNGSFRIST: "akte.erwiderungsfrist",

  // Berufung specific
  URTEIL_DATUM: "akte.urteil_datum",
  URTEIL_AZ: "akte.urteil_az",
  URTEIL_ZUSTELLUNG: "akte.urteil_zustellung",
  BERUFUNGSGRUENDE: "akte.berufungsgruende",
  BERUFUNGSFRIST_ENDE: "akte.berufungsfrist_ende",

  // Abmahnung specific
  VERSTOSS: "akte.verstoss",
  FRIST: "akte.frist",
  RECHTSGRUNDLAGE: "akte.rechtsgrundlage",
  SCHADENSERSATZ: "akte.schadensersatz",
  STRAFBEWEHRTE_UNTERLASSUNG: "akte.strafbewehrte_unterlassung",

  // Generic
  BETREFF: "akte.betreff",

  // Ergaenzung placeholders (used by LLM when details are missing)
  ERGAENZUNG: "ergaenzung.allgemein",
  ERGAENZUNG_SACHVERHALT: "ergaenzung.sachverhalt",
};

// Build reverse map once at module load
const REVERSE_MAP: Record<string, string> = {};
for (const [upper, dotted] of Object.entries(PLATZHALTER_MAP)) {
  // Only store the first mapping for each dotted key (avoids alias conflicts)
  if (!REVERSE_MAP[dotted]) {
    REVERSE_MAP[dotted] = upper;
  }
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** Regex to match {{UPPER_SNAKE_CASE}} placeholders */
const PLATZHALTER_REGEX = /\{\{([A-Z_]+)\}\}/g;

/**
 * Recursively walk all string values in an object (including nested objects
 * and arrays) and find all {{...}} patterns.
 *
 * @returns Deduplicated array of placeholder names (without braces)
 */
export function extractUnresolvedPlatzhalter(obj: unknown): string[] {
  const found = new Set<string>();
  walkStrings(obj, (str) => {
    let match: RegExpExecArray | null;
    PLATZHALTER_REGEX.lastIndex = 0;
    while ((match = PLATZHALTER_REGEX.exec(str)) !== null) {
      found.add(match[1]);
    }
  });
  return Array.from(found);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Deep-clone the Schriftsatz and replace all {{SLOT_KEY}} with the
 * corresponding value from slotValues.
 *
 * Does NOT throw if a placeholder has no matching slot value -- leaves
 * it as-is (will be caught by ERV-Validator).
 */
export function resolvePlatzhalterInSchema(
  schriftsatz: Schriftsatz,
  slotValues: SlotValues,
): Schriftsatz {
  // Deep-clone via JSON round-trip (safe for plain data objects)
  const cloned = JSON.parse(JSON.stringify(schriftsatz)) as Schriftsatz;

  walkAndReplace(cloned, (str) => {
    return str.replace(PLATZHALTER_REGEX, (fullMatch, key: string) => {
      const value = slotValues[key];
      if (value !== null && value !== undefined) {
        return String(value);
      }
      // No matching slot value -- leave placeholder as-is
      return fullMatch;
    });
  });

  return cloned;
}

// ---------------------------------------------------------------------------
// Format Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an UPPER_SNAKE_CASE key to its dotted.key equivalent.
 * @returns dotted.key or null if no mapping exists
 */
export function toDottedKey(upperSnakeKey: string): string | null {
  return PLATZHALTER_MAP[upperSnakeKey] ?? null;
}

/**
 * Convert a dotted.key to its UPPER_SNAKE_CASE equivalent.
 * @returns UPPER_SNAKE_CASE key or null if no mapping exists
 */
export function toUpperSnake(dottedKey: string): string | null {
  return REVERSE_MAP[dottedKey] ?? null;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walk all string values in a structure, calling fn for each.
 */
function walkStrings(obj: unknown, fn: (str: string) => void): void {
  if (typeof obj === "string") {
    fn(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkStrings(item, fn);
    }
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const value of Object.values(obj)) {
      walkStrings(value, fn);
    }
  }
}

/**
 * Recursively walk all string values and replace them in-place using fn.
 */
function walkAndReplace(
  obj: unknown,
  fn: (str: string) => string,
): void {
  if (obj === null || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === "string") {
        obj[i] = fn(obj[i]);
      } else {
        walkAndReplace(obj[i], fn);
      }
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    const record = obj as Record<string, unknown>;
    if (typeof record[key] === "string") {
      record[key] = fn(record[key] as string);
    } else {
      walkAndReplace(record[key], fn);
    }
  }
}
