/**
 * FristenRechner - Barrel Export
 *
 * German legal deadline calculation library implementing BGB Sections 187-193.
 * Pure functions only. No side effects. No DB access.
 */

// Types
export type {
  BundeslandCode,
  FristArt,
  FristDauer,
  FristInput,
  FristRueckwaertsInput,
  FristErgebnis,
  FristRueckwaertsErgebnis,
  VerschiebungsGrund,
  VorfristDatum,
  FristPreset,
} from './types'

// Calculator
export {
  berechneFrist,
  berechneFristRueckwaerts,
  isGeschaeftstag,
  naechsterGeschaeftstag,
  vorherigerGeschaeftstag,
} from './rechner'

// Holiday wrapper
export { istFeiertag, getFeiertage, getFeiertagName } from './feiertage'

// Vorfristen and Halbfrist
export { berechneVorfristen, berechneHalbfrist } from './vorfrist'

// Presets
export { DEFAULT_FRISTEN_PRESETS } from './presets'
