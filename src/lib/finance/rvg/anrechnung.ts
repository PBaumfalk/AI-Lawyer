// Anrechnung Algorithm - Vorbem. 3 Abs. 4 VV RVG
// Deduction of Geschaeftsgebuehr from Verfahrensgebuehr

import type { AnrechnungResult } from './types';

/**
 * Calculate Anrechnung (fee credit) per Vorbem. 3 Abs. 4 VV RVG.
 *
 * When a Geschaeftsgebuehr (VV 2300) and Verfahrensgebuehr (VV 3100) are both
 * charged for the SAME matter (Gegenstand), the Geschaeftsgebuehr is partially
 * credited against the Verfahrensgebuehr.
 *
 * Algorithm:
 * 1. Take the Geschaeftsgebuehr rate (e.g., 1.3)
 * 2. Halve it: 1.3 / 2 = 0.65
 * 3. Cap at 0.75: min(0.65, 0.75) = 0.65
 * 4. Credit amount = capped rate * base fee
 * 5. Reduce Verfahrensgebuehr by credit amount (but never below 0)
 *
 * @param geschaeftsgebuehrRate - Rate of the Geschaeftsgebuehr (e.g., 1.3)
 * @param verfahrensgebuehrRate - Rate of the Verfahrensgebuehr (e.g., 1.3)
 * @param baseFee - The base fee (1.0 rate) from the fee table
 * @returns Anrechnung result with credit amount and description
 */
export function calculateAnrechnung(
  geschaeftsgebuehrRate: number,
  verfahrensgebuehrRate: number,
  baseFee: number,
): AnrechnungResult {
  // Step 1: Halve the Geschaeftsgebuehr rate
  const halvedRate = geschaeftsgebuehrRate / 2;

  // Step 2: Cap at 0.75
  const cappedRate = Math.min(halvedRate, 0.75);

  // Step 3: Calculate credit amount
  const creditAmount = Math.round(cappedRate * baseFee * 100) / 100;

  // Step 4: Ensure credit doesn't exceed the Verfahrensgebuehr
  const verfahrensgebuehrAmount = Math.round(verfahrensgebuehrRate * baseFee * 100) / 100;
  const effectiveCredit = Math.min(creditAmount, verfahrensgebuehrAmount);

  return {
    sourceNr: '2300',
    targetNr: '3100',
    sourceRate: geschaeftsgebuehrRate,
    halvedRate: Math.round(halvedRate * 1000) / 1000,
    cappedRate,
    creditAmount: effectiveCredit,
    description:
      `Anrechnung gem. Vorbem. 3 Abs. 4 VV RVG: ` +
      `Geschaeftsgebuehr ${geschaeftsgebuehrRate.toFixed(1)} / 2 = ${halvedRate.toFixed(2)}, ` +
      `begrenzt auf ${cappedRate.toFixed(2)}, ` +
      `Anrechnungsbetrag: ${effectiveCredit.toFixed(2)} EUR`,
  };
}
