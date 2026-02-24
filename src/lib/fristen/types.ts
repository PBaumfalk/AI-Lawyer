/**
 * FristenRechner Type Definitions
 *
 * Types for German legal deadline calculation (BGB Sections 187-193).
 * Pure type definitions -- no runtime code, no side effects.
 */

/** All 16 German federal states (Bundeslaender) */
export type BundeslandCode =
  | 'BW' // Baden-Wuerttemberg
  | 'BY' // Bayern
  | 'BE' // Berlin
  | 'BB' // Brandenburg
  | 'HB' // Bremen
  | 'HE' // Hessen
  | 'HH' // Hamburg
  | 'MV' // Mecklenburg-Vorpommern
  | 'NI' // Niedersachsen
  | 'NW' // Nordrhein-Westfalen
  | 'RP' // Rheinland-Pfalz
  | 'SL' // Saarland
  | 'SN' // Sachsen
  | 'ST' // Sachsen-Anhalt
  | 'SH' // Schleswig-Holstein
  | 'TH' // Thueringen

/**
 * Frist type per BGB Section 187.
 *
 * EREIGNISFRIST (Abs. 1): Event day NOT counted. Frist starts next day.
 * BEGINNFRIST (Abs. 2): Start day IS counted (begins at 00:00).
 */
export type FristArt = 'EREIGNISFRIST' | 'BEGINNFRIST'

/** Duration components for a Frist. At least one field must be set. */
export interface FristDauer {
  tage?: number    // days
  wochen?: number  // weeks
  monate?: number  // months
  jahre?: number   // years
}

/** Input for forward deadline calculation */
export interface FristInput {
  /** The date of the event (Zustellungsdatum, Verkuendung, etc.) */
  zustellungsdatum: Date
  /** Ereignisfrist or Beginnfrist per BGB Section 187 */
  fristArt: FristArt
  /** Duration of the deadline */
  dauer: FristDauer
  /** Federal state for holiday lookup */
  bundesland: BundeslandCode
  /** Whether to apply Section 193 weekend/holiday extension (default: true) */
  section193?: boolean
}

/** Input for backward deadline calculation */
export interface FristRueckwaertsInput {
  /** The known deadline end date */
  fristende: Date
  /** Ereignisfrist or Beginnfrist per BGB Section 187 */
  fristArt: FristArt
  /** Duration of the deadline */
  dauer: FristDauer
  /** Federal state for holiday lookup */
  bundesland: BundeslandCode
}

/** Reason why a deadline was shifted per Section 193 */
export interface VerschiebungsGrund {
  /** The original date before shift */
  datum: Date
  /** Reason: Saturday, Sunday, or holiday name */
  grund: string
}

/** A Vorfrist (pre-deadline reminder) date */
export interface VorfristDatum {
  /** Number of calendar days before deadline */
  tageVorher: number
  /** The computed reminder date (shifted to previous business day if needed) */
  datum: Date
  /** Whether the date was shifted from its original position */
  verschoben: boolean
  /** Original date before any shift */
  originalDatum: Date
}

/** Result of a forward deadline calculation */
export interface FristErgebnis {
  /** Input that produced this result */
  eingabe: FristInput
  /** Start date of the Frist (day after event for Ereignisfrist, event day for Beginnfrist) */
  startDatum: Date
  /** Raw end date before Section 193 adjustment */
  rohEndDatum: Date
  /** Final end date after Section 193 adjustment (same as rohEndDatum if no shift needed) */
  endDatum: Date
  /** Whether Section 193 was applied */
  section193Angewendet: boolean
  /** Reasons for any shifts (empty if no shift) */
  verschiebungsGruende: VerschiebungsGrund[]
}

/** Result of a backward deadline calculation */
export interface FristRueckwaertsErgebnis {
  /** Input that produced this result */
  eingabe: FristRueckwaertsInput
  /** The latest possible Zustellungstermin to meet the deadline */
  spaetesterZustellungstermin: Date
  /** The deadline end date (same as input fristende) */
  fristende: Date
}

/** A preset for a common German legal deadline */
export interface FristPreset {
  /** Display name, e.g. "Berufungsfrist" */
  name: string
  /** Legal basis, e.g. "Section 517 ZPO" */
  rechtsgrundlage: string
  /** Ereignisfrist or Beginnfrist */
  fristArt: FristArt
  /** Duration */
  dauer: FristDauer
  /** Whether this is a Notfrist (cannot be extended) */
  istNotfrist: boolean
  /** Default Vorfristen in calendar days */
  defaultVorfristen: number[]
  /** Category for grouping */
  kategorie: 'zivilprozess' | 'verwaltungsrecht' | 'strafrecht' | 'arbeitsrecht' | 'allgemein'
}
