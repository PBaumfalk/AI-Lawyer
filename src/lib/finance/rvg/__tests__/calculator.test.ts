// RVG Fee Calculator - Comprehensive Test Suite
// 50+ tests covering fee computation, Anrechnung, GKG, PKH, calculator builder

import { describe, it, expect } from 'vitest';
import { computeBaseFee, getTableForDate, RVG_2025, RVG_2021, getLookupTable } from '../fee-table';
import { computeGkgFee, GKG_2025 } from '../gkg-table';
import { getVvPosition, searchVvPositions, VV_CATALOG } from '../vv-catalog';
import { calculateAnrechnung } from '../anrechnung';
import { computePkhFee, PKH_2025, PKH_2021 } from '../pkh';
import { RvgCalculator, computeRvgFee, buildCalculation } from '../calculator';
import { CALCULATOR_PRESETS, STREITWERT_VORSCHLAEGE, getPreset, calculateSuggestedStreitwert } from '../presets';

// =============================================================
// 1. RVG Fee Table (SS 13 RVG) - Base Fee Computation
// =============================================================
describe('RVG Fee Table - computeBaseFee', () => {
  describe('KostBRaeG 2025 table', () => {
    it('returns 0 for zero Streitwert', () => {
      expect(computeBaseFee(0)).toBe(0);
    });

    it('returns 0 for negative Streitwert', () => {
      expect(computeBaseFee(-100)).toBe(0);
    });

    it('returns 51.50 for Streitwert up to 500', () => {
      expect(computeBaseFee(1)).toBe(51.50);
      expect(computeBaseFee(250)).toBe(51.50);
      expect(computeBaseFee(500)).toBe(51.50);
    });

    it('computes correct fee at 1000 (first step boundary)', () => {
      expect(computeBaseFee(1000)).toBe(93.00);
    });

    it('rounds up to next step boundary within 500-2000 range', () => {
      // 501 rounds up to 1000
      expect(computeBaseFee(501)).toBe(93.00);
      // 999 also rounds up to 1000
      expect(computeBaseFee(999)).toBe(93.00);
      // 1001 rounds up to 1500
      expect(computeBaseFee(1001)).toBe(134.50);
    });

    it('computes correct fee at 2000', () => {
      expect(computeBaseFee(2000)).toBe(176.00);
    });

    it('computes correct fee at 5000', () => {
      expect(computeBaseFee(5000)).toBe(354.50);
    });

    it('computes correct fee at 10000', () => {
      expect(computeBaseFee(10000)).toBe(652.00);
    });

    it('computes correct fee at 25000', () => {
      expect(computeBaseFee(25000)).toBe(927.00);
    });

    it('computes correct fee at 50000', () => {
      expect(computeBaseFee(50000)).toBe(1357.00);
    });

    it('computes correct fee at 200000', () => {
      expect(computeBaseFee(200000)).toBe(2352.00);
    });

    it('computes correct fee at 500000', () => {
      expect(computeBaseFee(500000)).toBe(3752.00);
    });

    it('computes above-500k fee using formula', () => {
      // 550000: above 500000, ceil(50000/50000) = 1 step, +175.00
      expect(computeBaseFee(550000)).toBe(3927.00);
      // 600000: 2 steps
      expect(computeBaseFee(600000)).toBe(4102.00);
      // 1000000: 10 steps
      expect(computeBaseFee(1000000)).toBe(5502.00);
    });

    it('rounds Streitwert up to boundary in 2000-10000 range', () => {
      // 2001 rounds up to 3000
      expect(computeBaseFee(2001)).toBe(235.50);
      // 4999 rounds up to 5000
      expect(computeBaseFee(4999)).toBe(354.50);
    });

    it('rounds Streitwert up to boundary in 10000-25000 range', () => {
      // 10001 rounds up to 13000
      expect(computeBaseFee(10001)).toBe(707.00);
    });

    it('computes intermediate values in 50000-200000 range', () => {
      // 65000: baseFee at 50000 is 1357.00, one step of 15000
      expect(computeBaseFee(65000)).toBe(1456.50);
    });
  });

  describe('KostRaeG 2021 table', () => {
    it('returns 49.00 for Streitwert up to 500', () => {
      expect(computeBaseFee(500, RVG_2021)).toBe(49.00);
    });

    it('computes correct fee at 1000 (2021)', () => {
      expect(computeBaseFee(1000, RVG_2021)).toBe(88.00);
    });

    it('computes correct fee at 5000 (2021)', () => {
      expect(computeBaseFee(5000, RVG_2021)).toBe(334.00);
    });

    it('computes correct fee at 10000 (2021)', () => {
      expect(computeBaseFee(10000, RVG_2021)).toBe(614.00);
    });
  });

  describe('getTableForDate', () => {
    it('returns RVG_2025 for dates after 2025-06-01', () => {
      const table = getTableForDate(new Date('2025-07-01'));
      expect(table.id).toBe('RVG_2025');
    });

    it('returns RVG_2021 for dates before 2025-06-01', () => {
      const table = getTableForDate(new Date('2024-01-15'));
      expect(table.id).toBe('RVG_2021');
    });

    it('returns RVG_2025 for the exact start date', () => {
      const table = getTableForDate(new Date('2025-06-01'));
      expect(table.id).toBe('RVG_2025');
    });

    it('returns RVG_2021 for the last day of validity', () => {
      const table = getTableForDate(new Date('2025-05-31'));
      expect(table.id).toBe('RVG_2021');
    });

    it('defaults to newest table for future dates', () => {
      const table = getTableForDate(new Date('2030-01-01'));
      expect(table.id).toBe('RVG_2025');
    });
  });

  describe('getLookupTable', () => {
    it('returns non-empty lookup for RVG_2025', () => {
      const lookup = getLookupTable(RVG_2025);
      expect(lookup.length).toBeGreaterThan(10);
    });

    it('first entry is 500 -> 51.50', () => {
      const lookup = getLookupTable(RVG_2025);
      expect(lookup[0]).toEqual([500, 51.50]);
    });

    it('lookup table is monotonically increasing', () => {
      const lookup = getLookupTable(RVG_2025);
      for (let i = 1; i < lookup.length; i++) {
        expect(lookup[i][0]).toBeGreaterThan(lookup[i - 1][0]);
        expect(lookup[i][1]).toBeGreaterThan(lookup[i - 1][1]);
      }
    });
  });
});

// =============================================================
// 2. VV Catalog
// =============================================================
describe('VV Catalog', () => {
  it('contains all required positions', () => {
    const required = ['1000', '1003', '1008', '2300', '3100', '3104', '3200', '3202', '3305', '3307', '7002', '7003', '7005', '7008'];
    for (const nr of required) {
      expect(getVvPosition(nr)).toBeDefined();
    }
  });

  it('getVvPosition returns correct data for VV 3100', () => {
    const pos = getVvPosition('3100');
    expect(pos).toBeDefined();
    expect(pos!.name).toBe('Verfahrensgebuehr');
    expect(pos!.defaultRate).toBe(1.3);
    expect(pos!.feeType).toBe('wertgebuehr');
    expect(pos!.part).toBe(3);
  });

  it('getVvPosition returns undefined for unknown position', () => {
    expect(getVvPosition('9999')).toBeUndefined();
  });

  it('VV 2300 triggers Anrechnung on 3100', () => {
    const pos = getVvPosition('2300');
    expect(pos!.triggersAnrechnung).toBe(true);
    expect(pos!.anrechnungTarget).toBe('3100');
  });

  it('VV 7002 and 7008 are auto-addable', () => {
    expect(getVvPosition('7002')!.isAutoAddable).toBe(true);
    expect(getVvPosition('7008')!.isAutoAddable).toBe(true);
  });

  it('VV 1008 has max rate 2.0', () => {
    expect(getVvPosition('1008')!.maxRate).toBe(2.0);
  });

  describe('searchVvPositions', () => {
    it('finds positions by VV number', () => {
      const results = searchVvPositions('3100');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].nr).toBe('3100');
    });

    it('finds positions by keyword', () => {
      const results = searchVvPositions('Termin');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.nr === '3104')).toBe(true);
    });

    it('finds positions by category', () => {
      const results = searchVvPositions('einigung');
      expect(results.length).toBe(2); // 1000 and 1003
    });

    it('returns empty array for empty query', () => {
      expect(searchVvPositions('')).toEqual([]);
      expect(searchVvPositions('  ')).toEqual([]);
    });

    it('search is case-insensitive', () => {
      const results = searchVvPositions('VERFAHREN');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================
// 3. Anrechnung (Vorbem. 3 Abs. 4 VV RVG)
// =============================================================
describe('Anrechnung', () => {
  it('correctly calculates Anrechnung for standard rates (1.3/1.3)', () => {
    const result = calculateAnrechnung(1.3, 1.3, 100);
    expect(result.halvedRate).toBeCloseTo(0.65, 2);
    expect(result.cappedRate).toBe(0.65);
    expect(result.creditAmount).toBe(65.00);
  });

  it('caps at 0.75 when halved rate exceeds 0.75', () => {
    // Geschaeftsgebuehr 2.5: halved = 1.25, capped at 0.75
    const result = calculateAnrechnung(2.5, 1.3, 100);
    expect(result.halvedRate).toBeCloseTo(1.25, 2);
    expect(result.cappedRate).toBe(0.75);
    expect(result.creditAmount).toBe(75.00);
  });

  it('credit does not exceed Verfahrensgebuehr', () => {
    // Geschaeftsgebuehr 2.5, Verfahrensgebuehr 0.5, base 100
    // halved 1.25, capped 0.75, credit 75.00
    // but VG = 0.5 * 100 = 50.00, so credit limited to 50.00
    const result = calculateAnrechnung(2.5, 0.5, 100);
    expect(result.creditAmount).toBe(50.00);
  });

  it('handles small rates correctly', () => {
    const result = calculateAnrechnung(0.5, 1.3, 100);
    expect(result.halvedRate).toBe(0.25);
    expect(result.cappedRate).toBe(0.25);
    expect(result.creditAmount).toBe(25.00);
  });

  it('handles rate exactly at 1.5 (halved = 0.75)', () => {
    const result = calculateAnrechnung(1.5, 1.3, 100);
    expect(result.halvedRate).toBe(0.75);
    expect(result.cappedRate).toBe(0.75);
    expect(result.creditAmount).toBe(75.00);
  });

  it('includes description with all rates', () => {
    const result = calculateAnrechnung(1.3, 1.3, 100);
    expect(result.description).toContain('Vorbem. 3 Abs. 4');
    expect(result.description).toContain('1.3');
    expect(result.description).toContain('0.65');
  });

  it('sets correct source and target VV numbers', () => {
    const result = calculateAnrechnung(1.3, 1.3, 100);
    expect(result.sourceNr).toBe('2300');
    expect(result.targetNr).toBe('3100');
  });
});

// =============================================================
// 4. GKG Court Fees
// =============================================================
describe('GKG Court Fees', () => {
  it('returns 0 for zero Streitwert', () => {
    expect(computeGkgFee(0)).toBe(0);
  });

  it('returns correct fee for 5000', () => {
    expect(computeGkgFee(5000)).toBe(170.50);
  });

  it('returns correct fee for 25000', () => {
    expect(computeGkgFee(25000)).toBe(435.50);
  });

  it('returns correct fee for 50000', () => {
    expect(computeGkgFee(50000)).toBe(638.00);
  });

  it('returns correct fee for 500000', () => {
    expect(computeGkgFee(500000)).toBe(4138.00);
  });

  it('computes above-500k fee with formula', () => {
    // 600000: baseFee 4138 + ceil(100000/50000)*180 = 4138 + 360 = 4498
    expect(computeGkgFee(600000)).toBe(4498.00);
  });

  it('rounds up to next boundary', () => {
    // 4001 rounds up to 5000 boundary
    expect(computeGkgFee(4001)).toBe(170.50);
  });

  it('handles small Streitwert correctly', () => {
    expect(computeGkgFee(100)).toBe(41.00);
    expect(computeGkgFee(500)).toBe(41.00);
  });

  it('handles boundary value at 10000', () => {
    expect(computeGkgFee(10000)).toBe(310.50);
  });
});

// =============================================================
// 5. PKH Reduced Fees
// =============================================================
describe('PKH Reduced Fees', () => {
  it('returns 0 for zero Streitwert', () => {
    expect(computePkhFee(0)).toBe(0);
  });

  it('returns reduced fee for Streitwert within cap', () => {
    const fee = computePkhFee(5000);
    expect(fee).toBe(253.00);
  });

  it('returns null for Streitwert above cap', () => {
    expect(computePkhFee(100000)).toBeNull();
  });

  it('returns fee for Streitwert at cap boundary', () => {
    const fee = computePkhFee(80000);
    expect(fee).toBe(853.00);
    expect(fee).not.toBeNull();
  });

  it('PKH 2021 has lower cap of 50000', () => {
    expect(computePkhFee(50000, PKH_2021)).toBe(703.00);
    expect(computePkhFee(50001, PKH_2021)).toBeNull();
  });

  it('PKH fees are lower than full RVG fees', () => {
    const pkhFee = computePkhFee(10000);
    const rvgFee = computeBaseFee(10000);
    expect(pkhFee).not.toBeNull();
    expect(pkhFee!).toBeLessThan(rvgFee);
  });
});

// =============================================================
// 6. RVG Calculator Builder
// =============================================================
describe('RvgCalculator', () => {
  describe('Basic usage', () => {
    it('calculates a single position correctly', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100') // VG 1.3
        .getResult();

      const baseFee = computeBaseFee(5000);
      expect(result.items[0].amount).toBeCloseTo(baseFee * 1.3, 2);
      expect(result.items[0].vvNr).toBe('3100');
      expect(result.items[0].rate).toBe(1.3);
    });

    it('calculates multiple positions', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100') // VG 1.3
        .addPosition('3104') // TG 1.2
        .getResult();

      expect(result.items.length).toBe(2);
    });

    it('includes streitwert and fee table version in result', () => {
      const result = new RvgCalculator(5000, new Date('2025-07-01'))
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100')
        .getResult();

      expect(result.streitwert).toBe(5000);
      expect(result.feeTableVersion).toBe('RVG_2025');
    });

    it('throws error for unknown VV position', () => {
      const calc = new RvgCalculator(5000);
      expect(() => calc.addPosition('9999')).toThrow('VV position 9999 not found');
    });
  });

  describe('Rate override', () => {
    it('allows overriding the default rate', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100', { rate: 1.0 })
        .getResult();

      const baseFee = computeBaseFee(5000);
      expect(result.items[0].rate).toBe(1.0);
      expect(result.items[0].amount).toBeCloseTo(baseFee * 1.0, 2);
    });

    it('clamps rate to min/max bounds', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100', { rate: 5.0 }) // max is 1.3
        .getResult();

      expect(result.items[0].rate).toBe(1.3);
    });
  });

  describe('Auto-add Auslagenpauschale and USt', () => {
    it('auto-adds VV 7002 and VV 7008', () => {
      const result = new RvgCalculator(5000)
        .addPosition('3100')
        .getResult();

      expect(result.items.some((i) => i.vvNr === '7002')).toBe(true);
      expect(result.items.some((i) => i.vvNr === '7008')).toBe(true);
    });

    it('Auslagenpauschale is 20% of fees, max 20 EUR', () => {
      const result = new RvgCalculator(5000)
        .addPosition('3100') // VG 1.3
        .getResult();

      const auslagen = result.items.find((i) => i.vvNr === '7002');
      expect(auslagen).toBeDefined();
      expect(auslagen!.finalAmount).toBeLessThanOrEqual(20.00);
    });

    it('Auslagenpauschale caps at 20 EUR for high fees', () => {
      const result = new RvgCalculator(50000)
        .addPosition('3100') // High fee
        .addPosition('3104') // More fees
        .getResult();

      const auslagen = result.items.find((i) => i.vvNr === '7002');
      expect(auslagen!.finalAmount).toBe(20.00);
    });

    it('USt is 19% of total before USt', () => {
      const result = new RvgCalculator(5000)
        .addPosition('3100')
        .getResult();

      const ust = result.items.find((i) => i.vvNr === '7008');
      expect(ust).toBeDefined();
      expect(ust!.finalAmount).toBeCloseTo(result.nettoGesamt * 0.19, 0);
    });

    it('does not add Auslagen when disabled', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .addPosition('3100')
        .getResult();

      expect(result.items.some((i) => i.vvNr === '7002')).toBe(false);
    });

    it('does not add USt when disabled', () => {
      const result = new RvgCalculator(5000)
        .withoutUst()
        .addPosition('3100')
        .getResult();

      expect(result.items.some((i) => i.vvNr === '7008')).toBe(false);
    });
  });

  describe('Anrechnung detection', () => {
    it('auto-detects Anrechnung with 2300 + 3100', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('2300') // Geschaeftsgebuehr 1.3
        .addPosition('3100') // Verfahrensgebuehr 1.3
        .getResult();

      expect(result.anrechnung).not.toBeNull();
      expect(result.anrechnung!.sourceNr).toBe('2300');
      expect(result.anrechnung!.targetNr).toBe('3100');
    });

    it('correctly deducts Anrechnung from Verfahrensgebuehr', () => {
      const baseFee = computeBaseFee(5000);
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('2300', { rate: 1.3 }) // GG
        .addPosition('3100', { rate: 1.3 }) // VG
        .getResult();

      const vg = result.items.find((i) => i.vvNr === '3100')!;
      // Anrechnung: 1.3/2 = 0.65, capped at 0.75 -> 0.65
      // Credit = 0.65 * baseFee
      const expectedCredit = Math.round(0.65 * baseFee * 100) / 100;
      expect(vg.anrechnungDeduction).toBe(-expectedCredit);
      expect(vg.finalAmount).toBeCloseTo(baseFee * 1.3 - expectedCredit, 2);
    });

    it('does not apply Anrechnung without 2300', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100')
        .getResult();

      expect(result.anrechnung).toBeNull();
    });

    it('does not apply Anrechnung when disabled', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .withoutAnrechnung()
        .addPosition('2300')
        .addPosition('3100')
        .getResult();

      expect(result.anrechnung).toBeNull();
      const vg = result.items.find((i) => i.vvNr === '3100')!;
      expect(vg.anrechnungDeduction).toBe(0);
    });
  });

  describe('Erhoehungsgebuehr (VV 1008)', () => {
    it('calculates 0.3 per additional Auftraggeber', () => {
      const baseFee = computeBaseFee(5000);
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('1008', { anzahlAuftraggeber: 3 })
        .getResult();

      const item = result.items.find((i) => i.vvNr === '1008')!;
      // 3 Auftraggeber = 2 additional * 0.3 = 0.6
      expect(item.rate).toBe(0.6);
      expect(item.amount).toBeCloseTo(0.6 * baseFee, 2);
    });

    it('caps at 2.0 total Erhoehung', () => {
      const baseFee = computeBaseFee(5000);
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('1008', { anzahlAuftraggeber: 10 })
        .getResult();

      const item = result.items.find((i) => i.vvNr === '1008')!;
      // 10 Auftraggeber = 9 additional * 0.3 = 2.7, capped at 2.0
      expect(item.rate).toBe(2.0);
      expect(item.amount).toBeCloseTo(2.0 * baseFee, 2);
    });

    it('defaults to 2 Auftraggeber if not specified', () => {
      const baseFee = computeBaseFee(5000);
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('1008')
        .getResult();

      const item = result.items.find((i) => i.vvNr === '1008')!;
      expect(item.rate).toBe(0.3);
      expect(item.amount).toBeCloseTo(0.3 * baseFee, 2);
    });
  });

  describe('Per-position Gegenstandswert override', () => {
    it('uses override Gegenstandswert for specific position', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('3100', { gegenstandswert: 10000 })
        .getResult();

      const baseFee10k = computeBaseFee(10000);
      expect(result.items[0].gegenstandswert).toBe(10000);
      expect(result.items[0].amount).toBeCloseTo(baseFee10k * 1.3, 2);
    });
  });

  describe('Fahrtkosten (VV 7003)', () => {
    it('calculates km-based travel costs', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('7003', { km: 100 })
        .getResult();

      const item = result.items.find((i) => i.vvNr === '7003')!;
      expect(item.finalAmount).toBe(42.00); // 100 * 0.42
    });
  });

  describe('Totals and Result Structure', () => {
    it('nettoGesamt excludes USt', () => {
      const result = new RvgCalculator(5000)
        .addPosition('3100')
        .getResult();

      const ustItem = result.items.find((i) => i.vvNr === '7008');
      const sumWithoutUst = result.items
        .filter((i) => i.vvNr !== '7008')
        .reduce((sum, i) => sum + i.finalAmount, 0);

      expect(result.nettoGesamt).toBeCloseTo(sumWithoutUst, 2);
      expect(result.ustBetrag).toBeCloseTo(ustItem!.finalAmount, 2);
    });

    it('bruttoGesamt = nettoGesamt + ustBetrag', () => {
      const result = new RvgCalculator(5000)
        .addPosition('3100')
        .getResult();

      expect(result.bruttoGesamt).toBeCloseTo(result.nettoGesamt + result.ustBetrag, 2);
    });

    it('includes notices for Anrechnung', () => {
      const result = new RvgCalculator(5000)
        .withoutAuslagen()
        .withoutUst()
        .addPosition('2300')
        .addPosition('3100')
        .getResult();

      expect(result.notices.length).toBeGreaterThan(0);
      expect(result.notices[0]).toContain('Anrechnung');
    });
  });
});

// =============================================================
// 7. computeRvgFee convenience function
// =============================================================
describe('computeRvgFee', () => {
  it('computes fee for Streitwert and rate', () => {
    const baseFee = computeBaseFee(5000);
    expect(computeRvgFee(5000, 1.3)).toBeCloseTo(baseFee * 1.3, 2);
  });

  it('handles zero Streitwert', () => {
    expect(computeRvgFee(0, 1.3)).toBe(0);
  });

  it('uses specified table version', () => {
    const fee2021 = computeRvgFee(5000, 1.3, RVG_2021);
    const fee2025 = computeRvgFee(5000, 1.3, RVG_2025);
    expect(fee2021).not.toBe(fee2025);
  });
});

// =============================================================
// 8. buildCalculation convenience function
// =============================================================
describe('buildCalculation', () => {
  it('builds a full calculation from position array', () => {
    const result = buildCalculation(
      5000,
      [{ nr: '3100' }, { nr: '3104' }],
      { disableAutoAuslagen: true, disableAutoUst: true },
    );

    expect(result.items.length).toBe(2);
    expect(result.streitwert).toBe(5000);
  });

  it('passes options through correctly', () => {
    const result = buildCalculation(
      5000,
      [{ nr: '2300' }, { nr: '3100' }],
      { disableAnrechnung: true, disableAutoAuslagen: true, disableAutoUst: true },
    );

    expect(result.anrechnung).toBeNull();
  });

  it('uses specified auftragseingang date', () => {
    const result = buildCalculation(
      5000,
      [{ nr: '3100' }],
      { auftragseingang: new Date('2024-01-01'), disableAutoAuslagen: true, disableAutoUst: true },
    );

    expect(result.feeTableVersion).toBe('RVG_2021');
  });
});

// =============================================================
// 9. Presets
// =============================================================
describe('Presets', () => {
  it('has all required presets', () => {
    const requiredIds = [
      'klageverfahren-1-instanz',
      'aussergerichtlich',
      'klageverfahren-einigung',
      'berufung',
      'mahnverfahren',
    ];
    for (const id of requiredIds) {
      expect(getPreset(id)).toBeDefined();
    }
  });

  it('Klageverfahren preset includes 3100 + 3104 + 7002 + 7008', () => {
    const preset = getPreset('klageverfahren-1-instanz')!;
    const nrs = preset.vvPositions.map((p) => p.nr);
    expect(nrs).toContain('3100');
    expect(nrs).toContain('3104');
    expect(nrs).toContain('7002');
    expect(nrs).toContain('7008');
  });

  it('returns undefined for unknown preset', () => {
    expect(getPreset('nonexistent')).toBeUndefined();
  });
});

describe('Streitwert Vorschlaege', () => {
  it('has Kuendigungsschutz preset with multiplier 3', () => {
    const v = STREITWERT_VORSCHLAEGE.find((s) => s.id === 'kuendigungsschutz');
    expect(v).toBeDefined();
    expect(v!.multiplier).toBe(3);
  });

  it('has Mietstreit preset with multiplier 12', () => {
    const v = STREITWERT_VORSCHLAEGE.find((s) => s.id === 'mietstreit');
    expect(v).toBeDefined();
    expect(v!.multiplier).toBe(12);
  });

  it('calculateSuggestedStreitwert applies multiplier', () => {
    expect(calculateSuggestedStreitwert(4000, 'kuendigungsschutz')).toBe(12000);
    expect(calculateSuggestedStreitwert(800, 'mietstreit')).toBe(9600);
  });

  it('returns base value when no multiplier defined', () => {
    expect(calculateSuggestedStreitwert(5000, 'verkehrsunfall')).toBe(5000);
  });
});

// =============================================================
// 10. Integration: Full Calculation Scenarios
// =============================================================
describe('Integration: Full Scenarios', () => {
  it('Typisches Klageverfahren 1. Instanz at 5000 EUR', () => {
    const result = new RvgCalculator(5000, new Date('2025-07-01'))
      .addPosition('3100')  // VG 1.3
      .addPosition('3104')  // TG 1.2
      .getResult();

    expect(result.items.length).toBe(4); // VG + TG + Auslagen + USt
    expect(result.bruttoGesamt).toBeGreaterThan(0);
    expect(result.feeTableVersion).toBe('RVG_2025');

    // Verify VG and TG amounts
    const baseFee = computeBaseFee(5000);
    const vg = result.items.find((i) => i.vvNr === '3100')!;
    const tg = result.items.find((i) => i.vvNr === '3104')!;
    expect(vg.amount).toBeCloseTo(baseFee * 1.3, 2);
    expect(tg.amount).toBeCloseTo(baseFee * 1.2, 2);
  });

  it('Aussergerichtliche Vertretung mit Anrechnung at 10000 EUR', () => {
    const result = new RvgCalculator(10000, new Date('2025-07-01'))
      .addPosition('2300')  // GG 1.3
      .addPosition('3100')  // VG 1.3
      .addPosition('3104')  // TG 1.2
      .getResult();

    // Should have Anrechnung applied
    expect(result.anrechnung).not.toBeNull();

    const baseFee = computeBaseFee(10000);
    const vg = result.items.find((i) => i.vvNr === '3100')!;

    // VG reduced by Anrechnung
    const expectedCredit = Math.round(0.65 * baseFee * 100) / 100;
    expect(vg.finalAmount).toBeCloseTo(baseFee * 1.3 - expectedCredit, 2);
  });

  it('Berufung at 50000 EUR', () => {
    const result = new RvgCalculator(50000, new Date('2025-07-01'))
      .addPosition('3200')  // VG Berufung 1.6
      .addPosition('3202')  // TG Berufung 1.2
      .getResult();

    const baseFee = computeBaseFee(50000);
    const vg = result.items.find((i) => i.vvNr === '3200')!;
    expect(vg.amount).toBeCloseTo(baseFee * 1.6, 2);
    expect(result.bruttoGesamt).toBeGreaterThan(0);
  });

  it('Historical calculation with RVG 2021', () => {
    const result = new RvgCalculator(5000, new Date('2024-06-01'))
      .withoutAuslagen()
      .withoutUst()
      .addPosition('3100')
      .getResult();

    expect(result.feeTableVersion).toBe('RVG_2021');
    const baseFee2021 = computeBaseFee(5000, RVG_2021);
    expect(result.items[0].amount).toBeCloseTo(baseFee2021 * 1.3, 2);
  });

  it('Mahnverfahren at 3000 EUR', () => {
    const result = new RvgCalculator(3000, new Date('2025-07-01'))
      .addPosition('3305')  // 0.5
      .getResult();

    const baseFee = computeBaseFee(3000);
    const mahn = result.items.find((i) => i.vvNr === '3305')!;
    expect(mahn.amount).toBeCloseTo(baseFee * 0.5, 2);
  });
});
