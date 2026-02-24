// PKH (Prozesskostenhilfe) Reduced Fee Table - SS 49 RVG
// Betragsrahmengebuehren for cases with legal aid

import type { PkhTableVersion } from './types';

/**
 * PKH 2025 reduced fee table (KostBRaeG 2025, effective 2025-06-01)
 * SS 49 RVG - Reduced fees for PKH/VKH cases
 *
 * For Streitwert up to the cap (80,000 EUR per KostBRaeG 2025),
 * use the reduced PKH table. Above the cap, use the full RVG table.
 */
export const PKH_2025: PkhTableVersion = {
  id: 'PKH_2025',
  name: 'PKH Gebuehrentabelle 2025',
  lawReference: 'KostBRaeG 2025, SS 49 RVG',
  validFrom: new Date('2025-06-01'),
  validUntil: null,
  cap: 80_000,
  entries: [
    { upTo: 500, fee: 51.50 },
    { upTo: 1_000, fee: 82.00 },
    { upTo: 1_500, fee: 109.00 },
    { upTo: 2_000, fee: 136.00 },
    { upTo: 3_000, fee: 175.00 },
    { upTo: 4_000, fee: 214.00 },
    { upTo: 5_000, fee: 253.00 },
    { upTo: 6_000, fee: 278.00 },
    { upTo: 7_000, fee: 303.00 },
    { upTo: 8_000, fee: 328.00 },
    { upTo: 9_000, fee: 353.00 },
    { upTo: 10_000, fee: 378.00 },
    { upTo: 13_000, fee: 410.00 },
    { upTo: 16_000, fee: 442.00 },
    { upTo: 19_000, fee: 474.00 },
    { upTo: 22_000, fee: 506.00 },
    { upTo: 25_000, fee: 538.00 },
    { upTo: 30_000, fee: 579.00 },
    { upTo: 35_000, fee: 620.00 },
    { upTo: 40_000, fee: 661.00 },
    { upTo: 45_000, fee: 702.00 },
    { upTo: 50_000, fee: 743.00 },
    { upTo: 65_000, fee: 798.00 },
    { upTo: 80_000, fee: 853.00 },
  ],
};

/**
 * PKH 2021 reduced fee table
 */
export const PKH_2021: PkhTableVersion = {
  id: 'PKH_2021',
  name: 'PKH Gebuehrentabelle 2021',
  lawReference: 'KostRaeG 2021, SS 49 RVG',
  validFrom: new Date('2021-01-01'),
  validUntil: new Date('2025-05-31'),
  cap: 50_000,
  entries: [
    { upTo: 500, fee: 49.00 },
    { upTo: 1_000, fee: 78.00 },
    { upTo: 1_500, fee: 104.00 },
    { upTo: 2_000, fee: 130.00 },
    { upTo: 3_000, fee: 166.00 },
    { upTo: 4_000, fee: 202.00 },
    { upTo: 5_000, fee: 238.00 },
    { upTo: 6_000, fee: 262.00 },
    { upTo: 7_000, fee: 286.00 },
    { upTo: 8_000, fee: 310.00 },
    { upTo: 9_000, fee: 334.00 },
    { upTo: 10_000, fee: 358.00 },
    { upTo: 13_000, fee: 388.00 },
    { upTo: 16_000, fee: 418.00 },
    { upTo: 19_000, fee: 448.00 },
    { upTo: 22_000, fee: 478.00 },
    { upTo: 25_000, fee: 508.00 },
    { upTo: 30_000, fee: 547.00 },
    { upTo: 35_000, fee: 586.00 },
    { upTo: 40_000, fee: 625.00 },
    { upTo: 45_000, fee: 664.00 },
    { upTo: 50_000, fee: 703.00 },
  ],
};

/** All PKH table versions, newest first */
const PKH_TABLES: PkhTableVersion[] = [PKH_2025, PKH_2021];

/**
 * Select the correct PKH fee table for a given date.
 */
export function getPkhTableForDate(date: Date): PkhTableVersion {
  for (const table of PKH_TABLES) {
    const afterStart = date >= table.validFrom;
    const beforeEnd = table.validUntil === null || date <= table.validUntil;
    if (afterStart && beforeEnd) {
      return table;
    }
  }
  return PKH_TABLES[0];
}

/**
 * Compute the PKH reduced fee for a given Streitwert.
 *
 * For Streitwert up to the table cap, use the reduced PKH table.
 * Returns null for Streitwert above the cap (caller should use full RVG table).
 *
 * @param streitwert - The disputed amount in EUR
 * @param table - PKH table version to use (defaults to PKH_2025)
 * @returns Reduced PKH fee, or null if above cap
 */
export function computePkhFee(
  streitwert: number,
  table: PkhTableVersion = PKH_2025,
): number | null {
  if (streitwert <= 0) return 0;
  if (streitwert > table.cap) return null;

  for (const entry of table.entries) {
    if (streitwert <= entry.upTo) {
      return entry.fee;
    }
  }

  // Should not reach here if cap is set correctly
  return null;
}
