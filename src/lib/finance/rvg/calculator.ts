// RVG Calculator Engine - Builder Pattern
// Core calculation engine for German legal fees

import type {
  CalculationItem,
  CalculationResult,
  AnrechnungResult,
  PositionOptions,
  FeeTableVersion,
} from './types';
import { computeBaseFee, getTableForDate, RVG_2025 } from './fee-table';
import { getVvPosition } from './vv-catalog';
import { calculateAnrechnung } from './anrechnung';

/**
 * RVG Calculator with builder pattern.
 *
 * Usage:
 * ```ts
 * const result = new RvgCalculator(5000)
 *   .addPosition('3100')          // Verfahrensgebuehr 1.3
 *   .addPosition('3104')          // Terminsgebuehr 1.2
 *   .getResult();
 * ```
 *
 * Features:
 * - Automatically selects correct fee table version by date
 * - Auto-detects Anrechnung when both 2300 and 3100 are present
 * - Auto-adds VV 7002 (Auslagenpauschale) and VV 7008 (USt) unless disabled
 * - Supports Erhoehungsgebuehr (1008) for multiple Auftraggeber
 * - Supports per-position Gegenstandswert override
 */
export class RvgCalculator {
  private streitwert: number;
  private auftragseingang: Date;
  private feeTable: FeeTableVersion;
  private items: CalculationItem[] = [];
  private notices: string[] = [];
  private disableAutoAuslagen = false;
  private disableAutoUst = false;
  private disableAnrechnung = false;

  /**
   * Create a new RVG calculator.
   *
   * @param streitwert - The primary Streitwert (disputed amount) in EUR
   * @param auftragseingang - Date of Auftragseingang (determines fee table version)
   */
  constructor(streitwert: number, auftragseingang?: Date) {
    this.streitwert = streitwert;
    this.auftragseingang = auftragseingang || new Date();
    this.feeTable = getTableForDate(this.auftragseingang);
  }

  /**
   * Add a VV position to the calculation.
   *
   * @param vvNr - VV number (e.g., "3100")
   * @param options - Override options (rate, gegenstandswert, etc.)
   * @returns this (for chaining)
   */
  addPosition(vvNr: string, options: PositionOptions = {}): this {
    const vvPos = getVvPosition(vvNr);
    if (!vvPos) {
      throw new Error(`VV position ${vvNr} not found in catalog`);
    }

    const gegenstandswert = options.gegenstandswert ?? this.streitwert;
    const baseFee = computeBaseFee(gegenstandswert, this.feeTable);

    let amount: number;
    let rate: number | null = null;
    let notes: string | undefined;

    switch (vvPos.feeType) {
      case 'wertgebuehr': {
        if (vvNr === '1008') {
          // Erhoehungsgebuehr: 0.3 per additional Auftraggeber, max total 2.0
          const anzahl = options.anzahlAuftraggeber ?? 2;
          const additionalPersons = Math.max(0, anzahl - 1);
          rate = Math.min(additionalPersons * 0.3, 2.0);
          amount = Math.round(rate * baseFee * 100) / 100;
          notes = `${anzahl} Auftraggeber (${additionalPersons} zusaetzlich), Erhoehung ${rate.toFixed(1)}`;
        } else {
          rate = options.rate ?? vvPos.defaultRate;
          // Validate rate against min/max if defined
          if (vvPos.minRate !== null && rate < vvPos.minRate) {
            rate = vvPos.minRate;
          }
          if (vvPos.maxRate !== null && rate > vvPos.maxRate) {
            rate = vvPos.maxRate;
          }
          amount = Math.round(rate * baseFee * 100) / 100;
        }
        break;
      }

      case 'auslagen': {
        if (vvNr === '7002') {
          // Auslagenpauschale: 20% of all fees, max 20.00 EUR
          const totalFees = this.calculateCurrentFeesTotal();
          amount = Math.min(
            Math.round(totalFees * 0.20 * 100) / 100,
            20.00,
          );
          notes = `20% von ${totalFees.toFixed(2)} EUR, max. 20.00 EUR`;
        } else if (vvNr === '7008') {
          // USt: 19% of all fees + Auslagen (except USt itself)
          const totalBeforeUst = this.calculateTotalBeforeUst();
          rate = 0.19;
          amount = Math.round(totalBeforeUst * 0.19 * 100) / 100;
          notes = `19% von ${totalBeforeUst.toFixed(2)} EUR`;
        } else if (vvNr === '7003') {
          // Fahrtkosten: 0.42 EUR/km
          const km = options.km ?? 0;
          amount = Math.round(km * 0.42 * 100) / 100;
          notes = `${km} km x 0.42 EUR`;
        } else if (vvNr === '7005') {
          // Abwesenheitsgeld: tiered by hours
          const tage = options.tage ?? 1;
          const tagessatz = options.betrag ?? 80; // Default: over 8h
          amount = Math.round(tage * tagessatz * 100) / 100;
          notes = `${tage} Tag(e) x ${tagessatz.toFixed(2)} EUR`;
        } else {
          amount = options.betrag ?? 0;
        }
        break;
      }

      case 'festgebuehr': {
        amount = options.betrag ?? 0;
        break;
      }

      case 'betragsrahmen': {
        amount = options.betrag ?? 0;
        break;
      }

      default:
        amount = 0;
    }

    this.items.push({
      vvNr,
      name: vvPos.name,
      feeType: vvPos.feeType,
      rate,
      baseFee: vvPos.feeType === 'wertgebuehr' ? baseFee : null,
      gegenstandswert,
      amount,
      anrechnungDeduction: 0,
      finalAmount: amount,
      notes,
    });

    return this;
  }

  /**
   * Disable auto-addition of VV 7002 (Auslagenpauschale).
   */
  withoutAuslagen(): this {
    this.disableAutoAuslagen = true;
    return this;
  }

  /**
   * Disable auto-addition of VV 7008 (USt).
   */
  withoutUst(): this {
    this.disableAutoUst = true;
    return this;
  }

  /**
   * Disable Anrechnung detection and application.
   */
  withoutAnrechnung(): this {
    this.disableAnrechnung = true;
    return this;
  }

  /**
   * Get the complete calculation result.
   * This finalizes the calculation, applying:
   * 1. Anrechnung (if applicable)
   * 2. Auto-add VV 7002 (Auslagenpauschale) unless disabled
   * 3. Auto-add VV 7008 (USt) unless disabled
   */
  getResult(): CalculationResult {
    // Step 1: Apply Anrechnung if applicable
    let anrechnung: AnrechnungResult | null = null;

    if (!this.disableAnrechnung) {
      anrechnung = this.applyAnrechnung();
    }

    // Step 2: Auto-add VV 7002 (Auslagenpauschale)
    if (!this.disableAutoAuslagen && !this.items.some((i) => i.vvNr === '7002')) {
      this.addPosition('7002');
    }

    // Step 3: Auto-add VV 7008 (USt)
    if (!this.disableAutoUst && !this.items.some((i) => i.vvNr === '7008')) {
      this.addPosition('7008');
    }

    // Calculate totals
    const nettoGesamt = this.items
      .filter((i) => i.vvNr !== '7008')
      .reduce((sum, item) => sum + item.finalAmount, 0);

    const ustItem = this.items.find((i) => i.vvNr === '7008');
    const ustBetrag = ustItem ? ustItem.finalAmount : 0;

    const bruttoGesamt = Math.round((nettoGesamt + ustBetrag) * 100) / 100;

    return {
      items: [...this.items],
      anrechnung,
      streitwert: this.streitwert,
      auftragseingang: this.auftragseingang,
      feeTableVersion: this.feeTable.id,
      nettoGesamt: Math.round(nettoGesamt * 100) / 100,
      ustBetrag: Math.round(ustBetrag * 100) / 100,
      bruttoGesamt,
      notices: [...this.notices],
    };
  }

  /**
   * Apply Anrechnung if both Geschaeftsgebuehr (2300) and Verfahrensgebuehr (3100) are present.
   */
  private applyAnrechnung(): AnrechnungResult | null {
    const geschaeft = this.items.find((i) => i.vvNr === '2300');
    const verfahren = this.items.find((i) => i.vvNr === '3100');

    if (!geschaeft || !verfahren || geschaeft.rate === null || verfahren.rate === null) {
      return null;
    }

    // Use the same Gegenstandswert for Anrechnung calculation
    const baseFee = computeBaseFee(verfahren.gegenstandswert, this.feeTable);

    const result = calculateAnrechnung(
      geschaeft.rate,
      verfahren.rate,
      baseFee,
    );

    // Apply credit to Verfahrensgebuehr
    verfahren.anrechnungDeduction = -result.creditAmount;
    verfahren.finalAmount = Math.round(
      (verfahren.amount - result.creditAmount) * 100,
    ) / 100;
    verfahren.notes = (verfahren.notes ? verfahren.notes + '; ' : '') +
      `Anrechnung: -${result.creditAmount.toFixed(2)} EUR`;

    this.notices.push(result.description);

    return result;
  }

  /**
   * Calculate the sum of all current fee items (excluding Auslagen and USt).
   */
  private calculateCurrentFeesTotal(): number {
    return this.items
      .filter((i) => i.feeType === 'wertgebuehr')
      .reduce((sum, item) => sum + item.finalAmount, 0);
  }

  /**
   * Calculate the total before USt (all items except VV 7008).
   */
  private calculateTotalBeforeUst(): number {
    return this.items
      .filter((i) => i.vvNr !== '7008')
      .reduce((sum, item) => sum + item.finalAmount, 0);
  }
}

/**
 * Convenience function: Compute a single RVG fee for a Streitwert and rate.
 *
 * @param streitwert - The disputed amount in EUR
 * @param rate - The fee rate (e.g., 1.3)
 * @param table - Fee table version (defaults to RVG_2025)
 * @returns Computed fee amount
 */
export function computeRvgFee(
  streitwert: number,
  rate: number,
  table: FeeTableVersion = RVG_2025,
): number {
  const baseFee = computeBaseFee(streitwert, table);
  return Math.round(baseFee * rate * 100) / 100;
}

/**
 * Build a complete calculation using the builder pattern.
 * Convenience function for programmatic use.
 *
 * @param streitwert - The disputed amount in EUR
 * @param positions - Array of VV positions with optional overrides
 * @param options - Calculator options
 * @returns Complete calculation result
 */
export function buildCalculation(
  streitwert: number,
  positions: Array<{ nr: string; options?: PositionOptions }>,
  options?: {
    auftragseingang?: Date;
    disableAnrechnung?: boolean;
    disableAutoAuslagen?: boolean;
    disableAutoUst?: boolean;
  },
): CalculationResult {
  const calc = new RvgCalculator(streitwert, options?.auftragseingang);

  if (options?.disableAnrechnung) calc.withoutAnrechnung();
  if (options?.disableAutoAuslagen) calc.withoutAuslagen();
  if (options?.disableAutoUst) calc.withoutUst();

  for (const pos of positions) {
    calc.addPosition(pos.nr, pos.options || {});
  }

  return calc.getResult();
}
