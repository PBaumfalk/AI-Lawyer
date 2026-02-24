// RVG Fee Table - Anlage 2 zu SS 13 RVG
// Versioned fee tables with step algorithm for computing base fees

import type { FeeTableVersion } from './types';

/**
 * Build a complete lookup table for a fee table version.
 * The lookup is an array of [streitwertBoundary, fee] pairs,
 * precomputed from the step algorithm described in the law.
 *
 * For any Streitwert, you round UP to the next boundary and return that fee.
 */
function buildLookup(
  initialFee: number,
  ranges: Array<{
    rangeEnd: number;
    stepSize: number;
    increment: number;
  }>,
): Array<[number, number]> {
  const lookup: Array<[number, number]> = [[500, initialFee]];
  let currentFee = initialFee;
  let currentValue = 500;

  for (const range of ranges) {
    while (currentValue < range.rangeEnd) {
      currentValue += range.stepSize;
      currentFee += range.increment;
      // Round to 2 decimal places to avoid floating point drift
      currentFee = Math.round(currentFee * 100) / 100;
      lookup.push([currentValue, currentFee]);
    }
  }

  return lookup;
}

/**
 * KostBRaeG 2025 fee table (Anlage 2 zu SS 13 RVG, effective 2025-06-01)
 *
 * Step algorithm as defined in SS 13 RVG:
 * - Up to 500 EUR: base fee 51.50 EUR
 * - 500-2000: +41.50 per 500 step
 * - 2000-10000: +59.50 per 1000 step
 * - 10000-25000: +55.00 per 3000 step
 * - 25000-50000: +86.00 per 5000 step
 * - 50000-200000: +99.50 per 15000 step
 * - 200000-500000: +140.00 per 30000 step
 * - Above 500000: +175.00 per 50000 step
 */
const RVG_2025_RANGES = [
  { rangeEnd: 2_000, stepSize: 500, increment: 41.50 },
  { rangeEnd: 10_000, stepSize: 1_000, increment: 59.50 },
  { rangeEnd: 25_000, stepSize: 3_000, increment: 55.00 },
  { rangeEnd: 50_000, stepSize: 5_000, increment: 86.00 },
  { rangeEnd: 200_000, stepSize: 15_000, increment: 99.50 },
  { rangeEnd: 500_000, stepSize: 30_000, increment: 140.00 },
];

const RVG_2025_LOOKUP = buildLookup(51.50, RVG_2025_RANGES);

export const RVG_2025: FeeTableVersion = {
  id: 'RVG_2025',
  name: 'RVG Gebuehrentabelle 2025',
  lawReference: 'KostBRaeG 2025, Anlage 2 zu SS 13 RVG',
  validFrom: new Date('2025-06-01'),
  validUntil: null,
  initialFee: 51.50,
  // Steps kept for reference/metadata
  steps: [
    { upTo: 2_000, baseFee: 51.50, increment: 41.50, stepSize: 500 },
    { upTo: 10_000, baseFee: 176.00, increment: 59.50, stepSize: 1_000 },
    { upTo: 25_000, baseFee: 652.00, increment: 55.00, stepSize: 3_000 },
    { upTo: 50_000, baseFee: 927.00, increment: 86.00, stepSize: 5_000 },
    { upTo: 200_000, baseFee: 1_357.00, increment: 99.50, stepSize: 15_000 },
    { upTo: 500_000, baseFee: 2_352.00, increment: 140.00, stepSize: 30_000 },
    { upTo: Infinity, baseFee: 3_752.00, increment: 175.00, stepSize: 50_000 },
  ],
};

/**
 * KostRaeG 2021 fee table (Anlage 2 zu SS 13 RVG, effective 2021-01-01 through 2025-05-31)
 * Historical table for Auftragseingang before KostBRaeG 2025
 */
const RVG_2021_RANGES = [
  { rangeEnd: 2_000, stepSize: 500, increment: 39.00 },
  { rangeEnd: 10_000, stepSize: 1_000, increment: 56.00 },
  { rangeEnd: 25_000, stepSize: 3_000, increment: 52.00 },
  { rangeEnd: 50_000, stepSize: 5_000, increment: 81.00 },
  { rangeEnd: 200_000, stepSize: 15_000, increment: 94.00 },
  { rangeEnd: 500_000, stepSize: 30_000, increment: 132.00 },
];

const RVG_2021_LOOKUP = buildLookup(49.00, RVG_2021_RANGES);

export const RVG_2021: FeeTableVersion = {
  id: 'RVG_2021',
  name: 'RVG Gebuehrentabelle 2021',
  lawReference: 'KostRaeG 2021, Anlage 2 zu SS 13 RVG',
  validFrom: new Date('2021-01-01'),
  validUntil: new Date('2025-05-31'),
  initialFee: 49.00,
  steps: [
    { upTo: 2_000, baseFee: 49.00, increment: 39.00, stepSize: 500 },
    { upTo: 10_000, baseFee: 166.00, increment: 56.00, stepSize: 1_000 },
    { upTo: 25_000, baseFee: 614.00, increment: 52.00, stepSize: 3_000 },
    { upTo: 50_000, baseFee: 874.00, increment: 81.00, stepSize: 5_000 },
    { upTo: 200_000, baseFee: 1_279.00, increment: 94.00, stepSize: 15_000 },
    { upTo: 500_000, baseFee: 2_217.00, increment: 132.00, stepSize: 30_000 },
    { upTo: Infinity, baseFee: 3_537.00, increment: 165.00, stepSize: 50_000 },
  ],
};

/** All available fee table versions, newest first */
const FEE_TABLES: FeeTableVersion[] = [RVG_2025, RVG_2021];

/** Lookup tables indexed by version id */
const LOOKUP_TABLES: Record<string, Array<[number, number]>> = {
  RVG_2025: RVG_2025_LOOKUP,
  RVG_2021: RVG_2021_LOOKUP,
};

/** Above-table formula parameters per version */
const ABOVE_TABLE_PARAMS: Record<string, { increment: number; stepSize: number }> = {
  RVG_2025: { increment: 175.00, stepSize: 50_000 },
  RVG_2021: { increment: 165.00, stepSize: 50_000 },
};

/**
 * Select the correct fee table version for a given date.
 * Falls back to the newest table if no exact match found.
 */
export function getTableForDate(date: Date): FeeTableVersion {
  for (const table of FEE_TABLES) {
    const afterStart = date >= table.validFrom;
    const beforeEnd = table.validUntil === null || date <= table.validUntil;
    if (afterStart && beforeEnd) {
      return table;
    }
  }
  // Default to newest table
  return FEE_TABLES[0];
}

/**
 * Compute the base fee (1.0 rate) for a given Streitwert.
 *
 * Algorithm:
 * 1. If Streitwert <= 0, return 0
 * 2. Find the table boundary >= Streitwert (round up)
 * 3. Return the fee at that boundary
 * 4. For values above the table maximum (500k), extrapolate with formula
 *
 * @param streitwert - The disputed amount in EUR
 * @param table - Fee table version to use (defaults to RVG_2025)
 * @returns Base fee for 1.0 rate
 */
export function computeBaseFee(
  streitwert: number,
  table: FeeTableVersion = RVG_2025,
): number {
  if (streitwert <= 0) return 0;

  const lookup = LOOKUP_TABLES[table.id];
  if (!lookup) return 0;

  // Find the first boundary >= streitwert (round-up behavior)
  for (const [boundary, fee] of lookup) {
    if (streitwert <= boundary) {
      return fee;
    }
  }

  // Above the table: extrapolate using the above-500k formula
  const lastEntry = lookup[lookup.length - 1];
  const maxBoundary = lastEntry[0];
  const maxFee = lastEntry[1];
  const params = ABOVE_TABLE_PARAMS[table.id];

  const amountAbove = streitwert - maxBoundary;
  const extraSteps = Math.ceil(amountAbove / params.stepSize);
  return Math.round((maxFee + extraSteps * params.increment) * 100) / 100;
}

/**
 * Get the complete lookup table for a given fee table version.
 * Useful for displaying the fee schedule in the UI.
 */
export function getLookupTable(
  table: FeeTableVersion = RVG_2025,
): Array<[number, number]> {
  return LOOKUP_TABLES[table.id] || [];
}
