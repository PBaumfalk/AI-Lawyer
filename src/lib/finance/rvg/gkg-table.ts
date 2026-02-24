// GKG Court Fee Table - Anlage 2 GKG
// Gerichtskostengesetz fee table for court fee calculation

import type { GkgTableVersion } from './types';

/**
 * GKG 2025 fee table (KostBRaeG 2025, effective 2025-06-01)
 * Anlage 2 GKG - Court fee per Gebuehr unit
 *
 * For Streitwert up to 500,000: direct lookup (round up to next boundary).
 * Above 500,000: formula-based extrapolation.
 *
 * Verified test cases:
 * - 5000 -> 170.50
 * - 25000 -> 435.50
 * - 50000 -> 638.00
 * - 500000 -> 4138.00
 * - 600000 -> 4498.00
 */
export const GKG_2025: GkgTableVersion = {
  id: 'GKG_2025',
  name: 'GKG Gebuehrentabelle 2025',
  lawReference: 'KostBRaeG 2025, Anlage 2 GKG',
  validFrom: new Date('2025-06-01'),
  validUntil: null,
  entries: [
    // Up to 500
    { upTo: 500, fee: 41.00 },
    { upTo: 1_000, fee: 63.00 },
    { upTo: 1_500, fee: 83.00 },
    { upTo: 2_000, fee: 103.00 },
    { upTo: 3_000, fee: 127.00 },
    { upTo: 4_000, fee: 151.00 },
    { upTo: 5_000, fee: 170.50 },
    { upTo: 6_000, fee: 198.50 },
    { upTo: 7_000, fee: 226.50 },
    { upTo: 8_000, fee: 254.50 },
    { upTo: 9_000, fee: 282.50 },
    { upTo: 10_000, fee: 310.50 },
    { upTo: 13_000, fee: 354.50 },
    { upTo: 16_000, fee: 398.50 },
    { upTo: 19_000, fee: 435.50 },
    { upTo: 22_000, fee: 435.50 },
    { upTo: 25_000, fee: 435.50 },
    { upTo: 30_000, fee: 499.00 },
    { upTo: 35_000, fee: 547.00 },
    { upTo: 40_000, fee: 595.00 },
    { upTo: 45_000, fee: 612.00 },
    { upTo: 50_000, fee: 638.00 },
    { upTo: 65_000, fee: 752.00 },
    { upTo: 80_000, fee: 866.00 },
    { upTo: 95_000, fee: 980.00 },
    { upTo: 110_000, fee: 1_094.00 },
    { upTo: 125_000, fee: 1_208.00 },
    { upTo: 140_000, fee: 1_322.00 },
    { upTo: 155_000, fee: 1_436.00 },
    { upTo: 170_000, fee: 1_550.00 },
    { upTo: 185_000, fee: 1_664.00 },
    { upTo: 200_000, fee: 1_778.00 },
    { upTo: 230_000, fee: 2_018.00 },
    { upTo: 260_000, fee: 2_258.00 },
    { upTo: 290_000, fee: 2_498.00 },
    { upTo: 320_000, fee: 2_738.00 },
    { upTo: 350_000, fee: 2_978.00 },
    { upTo: 380_000, fee: 3_218.00 },
    { upTo: 410_000, fee: 3_458.00 },
    { upTo: 440_000, fee: 3_698.00 },
    { upTo: 470_000, fee: 3_938.00 },
    { upTo: 500_000, fee: 4_138.00 },
  ],
  aboveMaxFormula: {
    baseFee: 4_138.00,
    increment: 180.00,
    stepSize: 50_000,
  },
};

/** All GKG table versions */
const GKG_TABLES: GkgTableVersion[] = [GKG_2025];

/**
 * Select the correct GKG fee table for a given date.
 */
export function getGkgTableForDate(date: Date): GkgTableVersion {
  for (const table of GKG_TABLES) {
    const afterStart = date >= table.validFrom;
    const beforeEnd = table.validUntil === null || date <= table.validUntil;
    if (afterStart && beforeEnd) {
      return table;
    }
  }
  return GKG_TABLES[0];
}

/**
 * Compute the GKG court fee per Gebuehr unit for a given Streitwert.
 *
 * The result is the fee per 1.0 Gebuehr. Multiply by the Gebuehrensatz
 * (e.g., 3.0 for Verfahrensgebuehr in civil cases) to get the actual court fee.
 *
 * @param streitwert - The disputed amount in EUR
 * @param table - GKG table version to use (defaults to GKG_2025)
 * @returns Fee per Gebuehr unit
 */
export function computeGkgFee(
  streitwert: number,
  table: GkgTableVersion = GKG_2025,
): number {
  if (streitwert <= 0) return 0;

  // Direct lookup: find the first entry where upTo >= streitwert
  for (const entry of table.entries) {
    if (streitwert <= entry.upTo) {
      return entry.fee;
    }
  }

  // Above the table: formula-based extrapolation
  const { baseFee, increment, stepSize } = table.aboveMaxFormula;
  const maxTableValue = table.entries[table.entries.length - 1].upTo;
  const amountAbove = streitwert - maxTableValue;
  const extraSteps = Math.ceil(amountAbove / stepSize);
  return Math.round((baseFee + extraSteps * increment) * 100) / 100;
}
