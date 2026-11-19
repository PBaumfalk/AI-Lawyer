// RVG Calculator Presets
// Quick presets for common case types and Streitwert suggestions

import type { CalculatorPreset, StreitwertVorschlag } from './types';

/**
 * Pre-configured position combinations for common case types.
 * Each preset adds a standard set of VV positions.
 */
export const CALCULATOR_PRESETS: CalculatorPreset[] = [
  {
    id: 'klageverfahren-1-instanz',
    name: 'Typisches Klageverfahren 1. Instanz',
    description: 'Verfahrensgebühr + Terminsgebühr + Auslagen + USt',
    vvPositions: [
      { nr: '3100' },
      { nr: '3104' },
      { nr: '7002' },
      { nr: '7008' },
    ],
  },
  {
    id: 'aussergerichtlich',
    name: 'Außergerichtliche Vertretung',
    description: 'Geschäftsgebühr + Auslagen + USt',
    vvPositions: [
      { nr: '2300' },
      { nr: '7002' },
      { nr: '7008' },
    ],
  },
  {
    id: 'klageverfahren-einigung',
    name: 'Klageverfahren mit Einigung',
    description: 'Verfahrensgebühr + Terminsgebühr + Einigungsgebühr + Auslagen + USt',
    vvPositions: [
      { nr: '3100' },
      { nr: '3104' },
      { nr: '1003' },
      { nr: '7002' },
      { nr: '7008' },
    ],
  },
  {
    id: 'berufung',
    name: 'Berufung',
    description: 'Verfahrensgebühr Berufung + Terminsgebühr + Auslagen + USt',
    vvPositions: [
      { nr: '3200' },
      { nr: '3202' },
      { nr: '7002' },
      { nr: '7008' },
    ],
  },
  {
    id: 'mahnverfahren',
    name: 'Mahnverfahren',
    description: 'Verfahrensgebühr Mahnverfahren + Auslagen + USt',
    vvPositions: [
      { nr: '3305' },
      { nr: '7002' },
      { nr: '7008' },
    ],
  },
];

/**
 * Streitwert suggestions for common case types.
 * Helps users estimate the correct Streitwert.
 */
export const STREITWERT_VORSCHLAEGE: StreitwertVorschlag[] = [
  {
    id: 'kuendigungsschutz',
    name: 'Kündigungsschutzklage',
    formel: '3 x Bruttomonatsgehalt',
    beispiel: 12000,
    multiplier: 3,
    basisEinheit: 'Bruttomonatsgehalt',
  },
  {
    id: 'mietstreit',
    name: 'Mietstreitigkeit',
    formel: '12 x Monatsmiete (Jahresnettokaltmiete)',
    beispiel: 9600,
    multiplier: 12,
    basisEinheit: 'Monatsmiete (nettokalt)',
  },
  {
    id: 'verkehrsunfall',
    name: 'Verkehrsunfall',
    formel: 'Schadenshöhe (Reparatur + Mietwagen + Schmerzensgeld)',
    beispiel: 8000,
  },
  {
    id: 'schmerzensgeld',
    name: 'Schmerzensgeld',
    formel: 'Geschätzte Schmerzensgeldsumme',
    beispiel: 5000,
  },
  {
    id: 'kaufvertrag',
    name: 'Kaufvertragsstreitigkeit',
    formel: 'Kaufpreis bzw. Wertminderung',
    beispiel: 3000,
  },
  {
    id: 'werkvertrag',
    name: 'Werkvertragsstreitigkeit',
    formel: 'Mängelbeseitigungskosten oder Minderungsbetrag',
    beispiel: 15000,
  },
  {
    id: 'unterhalt',
    name: 'Unterhaltsstreitigkeit',
    formel: '12 x monatlicher Unterhaltsbetrag',
    beispiel: 6000,
    multiplier: 12,
    basisEinheit: 'monatlicher Unterhalt',
  },
  {
    id: 'raeumungsklage',
    name: 'Räumungsklage',
    formel: '12 x Monatsmiete',
    beispiel: 9600,
    multiplier: 12,
    basisEinheit: 'Monatsmiete',
  },
];

/**
 * Get a preset by ID.
 */
export function getPreset(id: string): CalculatorPreset | undefined {
  return CALCULATOR_PRESETS.find((p) => p.id === id);
}

/**
 * Get a Streitwert suggestion by ID.
 */
export function getStreitwertVorschlag(id: string): StreitwertVorschlag | undefined {
  return STREITWERT_VORSCHLAEGE.find((v) => v.id === id);
}

/**
 * Calculate suggested Streitwert from a base value and multiplier.
 *
 * @param basisWert - The base value (e.g., monthly salary)
 * @param vorschlagId - ID of the Streitwert suggestion to use
 * @returns Calculated Streitwert or the base value if no multiplier defined
 */
export function calculateSuggestedStreitwert(
  basisWert: number,
  vorschlagId: string,
): number {
  const vorschlag = getStreitwertVorschlag(vorschlagId);
  if (!vorschlag || !vorschlag.multiplier) return basisWert;
  return Math.round(basisWert * vorschlag.multiplier * 100) / 100;
}
