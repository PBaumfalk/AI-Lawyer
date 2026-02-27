/**
 * Institution whitelist for German court and government body names.
 *
 * These patterns identify names that MUST NOT be treated as PII (natural persons).
 * Applied after NER extraction to prevent false positives before the PII gate.
 *
 * Sources:
 * - German federal court system (7 Bundesgerichte)
 * - German state court naming conventions (Amtsgericht, Landgericht, etc.)
 * - Standard German court abbreviations (AG, LG, OLG, BAG, BGH, etc.)
 * - Government bodies named in Urteil headers (Senat, Kammer, Staatsanwaltschaft, etc.)
 */

/**
 * Regex patterns that match German court and government institution names.
 * Any candidate name matching at least one pattern is considered an institution, not a person.
 */
export const INSTITUTION_PATTERNS: RegExp[] = [
  // Seven Federal Courts (Bundesgerichte)
  /\bBundesgerichtshof\b/i,
  /\bBundesarbeitsgericht\b/i,
  /\bBundesverwaltungsgericht\b/i,
  /\bBundesfinanzhof\b/i,
  /\bBundessozialgericht\b/i,
  /\bBundespatentgericht\b/i,
  /\bBundesverfassungsgericht\b/i,

  // Regional court names (pattern-based: court type + city name)
  /\b(Amtsgericht|Landgericht|Oberlandesgericht|Arbeitsgericht|Landesarbeitsgericht|Sozialgericht|Landessozialgericht|Finanzgericht|Verwaltungsgericht|Oberverwaltungsgericht)\s+\w+/i,

  // Standard German court abbreviations
  /\b(AG|LG|OLG|LAG|LSG|SG|VG|OVG|BAG|BGH|BVerfG|BFH|BVerwG|BSG|BPatG)\b/,

  // Government bodies and statutory organs
  /\bBundesministerium\b/i,
  /\bLandesministerium\b/i,
  /\bSenatskommission\b/i,
  /\bSenat\b/i,           // "Der Senat", "2. Senat" — chamber/panel in Urteil headers
  /\bKammer\b/i,          // "Die Kammer", "2. Kammer" — chamber in regional courts
  /\bStaatsanwaltschaft\b/i,
  /\bGeneralbundesanwalt\b/i,
  /\bJustizminister(ium)?\b/i,

  // Constitutional and parliamentary bodies
  /\bBundesrepublik\b/i,
  /\bLandtag\b/i,
  /\bBundestag\b/i,
];

/**
 * Returns true if the candidate string matches any known German institution name pattern.
 *
 * Use this after NER extraction to filter out courts, government bodies, and
 * statutory organs that LLMs may incorrectly extract as natural persons.
 *
 * @param candidate - A name string extracted by the NER model
 * @returns true if the candidate is an institution name (NOT a natural person)
 *
 * @example
 * isInstitutionName("Bundesgerichtshof")       // → true  (federal court)
 * isInstitutionName("Amtsgericht Koeln")       // → true  (regional court)
 * isInstitutionName("BGH")                     // → true  (abbreviation)
 * isInstitutionName("2. Senat")                // → true  (panel)
 * isInstitutionName("Kammer")                  // → true  (chamber)
 * isInstitutionName("Staatsanwaltschaft Muenchen") // → true (prosecution body)
 * isInstitutionName("Hans Mueller")            // → false (natural person)
 */
export function isInstitutionName(candidate: string): boolean {
  return INSTITUTION_PATTERNS.some((pattern) => pattern.test(candidate));
}
