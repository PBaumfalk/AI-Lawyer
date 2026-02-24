// Fremdgeld Compliance Tests
// Tests for 5-Werktage deadline calculation, urgency classification,
// and Anderkonto threshold (15k EUR)

import { describe, it, expect } from 'vitest';
import {
  calculateFremdgeldDeadline,
  countRemainingBusinessDays,
  classifyDringlichkeit,
  isBusinessDay,
} from '../fremdgeld';
import { ANDERKONTO_SCHWELLE } from '../types';

describe('calculateFremdgeldDeadline', () => {
  // ─── Basic 5-Business-Day Tests ──────────────────────────────────────────

  it('should add exactly 5 business days from a Monday', () => {
    // Monday 2026-01-05 + 5 business days = Monday 2026-01-12
    const monday = new Date(2026, 0, 5, 12, 0, 0);
    const result = calculateFremdgeldDeadline(monday);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(12);
    // Result should be a Monday
    expect(result.getDay()).toBe(1);
  });

  it('should add 5 business days from a Wednesday', () => {
    // Wednesday 2026-01-07 + 5 business days = Wednesday 2026-01-14
    const wednesday = new Date(2026, 0, 7, 12, 0, 0);
    const result = calculateFremdgeldDeadline(wednesday);
    expect(result.getDate()).toBe(14);
    expect(result.getDay()).toBe(3); // Wednesday
  });

  it('should skip weekends when counting business days', () => {
    // Thursday 2026-01-08 + 5 business days:
    // Fri 9, (skip Sat 10, Sun 11), Mon 12, Tue 13, Wed 14, Thu 15
    // = Thursday 2026-01-15
    const thursday = new Date(2026, 0, 8, 12, 0, 0);
    const result = calculateFremdgeldDeadline(thursday);
    expect(result.getDate()).toBe(15);
    expect(result.getDay()).toBe(4); // Thursday
  });

  it('should skip weekends starting from Friday', () => {
    // Friday 2026-01-09 + 5 business days:
    // (skip Sat 10, Sun 11), Mon 12, Tue 13, Wed 14, Thu 15, Fri 16
    // = Friday 2026-01-16
    const friday = new Date(2026, 0, 9, 12, 0, 0);
    const result = calculateFremdgeldDeadline(friday);
    expect(result.getDate()).toBe(16);
    expect(result.getDay()).toBe(5); // Friday
  });

  // ─── Holiday Tests (NRW) ─────────────────────────────────────────────────

  it('should skip Neujahr (Jan 1) in NRW', () => {
    // Wednesday 2025-12-29 + 5 business days:
    // Tue 30, Wed 31, (skip Neujahr Jan 1), Fri Jan 2,
    // (skip Sat 3, Sun 4), Mon 5, Tue 6
    // = Tuesday 2026-01-06
    const dec29 = new Date(2025, 11, 29, 12, 0, 0);
    const result = calculateFremdgeldDeadline(dec29, 'NW');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(6);
  });

  it('should skip Karfreitag and Ostermontag in NRW', () => {
    // 2026: Karfreitag = Apr 3, Ostermontag = Apr 6
    // Monday 2026-03-30 + 5 business days:
    // Tue 31, Wed Apr 1, Thu 2, (skip Karfreitag Apr 3),
    // (skip Sat 4, Sun 5), (skip Ostermontag Apr 6), Tue 7, Wed 8
    // = Wednesday 2026-04-08
    const mar30 = new Date(2026, 2, 30, 12, 0, 0);
    const result = calculateFremdgeldDeadline(mar30, 'NW');
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(8);
  });

  it('should skip Tag der Arbeit (May 1) in NRW', () => {
    // 2026: May 1 = Friday
    // Monday 2026-04-27 + 5 business days:
    // Tue 28, Wed 29, Thu 30, (skip May 1), (skip Sat 2, Sun 3), Mon 4, Tue 5
    // = Tuesday 2026-05-05
    const apr27 = new Date(2026, 3, 27, 12, 0, 0);
    const result = calculateFremdgeldDeadline(apr27, 'NW');
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(5);
  });

  it('should skip Tag der Deutschen Einheit (Oct 3) in NRW', () => {
    // 2026: Oct 3 = Saturday -> no effect (already weekend)
    // 2025: Oct 3 = Friday
    // Monday 2025-09-29 + 5 business days:
    // Tue 30, Wed Oct 1, Thu 2, (skip Oct 3 - Feiertag + Friday),
    // (skip Sat 4, Sun 5), Mon 6, Tue 7
    // = Tuesday 2025-10-07
    const sep29 = new Date(2025, 8, 29, 12, 0, 0);
    const result = calculateFremdgeldDeadline(sep29, 'NW');
    expect(result.getMonth()).toBe(9); // October
    expect(result.getDate()).toBe(7);
  });

  it('should skip Weihnachten (Dec 25 + 26) in NRW', () => {
    // 2026: Dec 25 = Friday, Dec 26 = Saturday
    // Monday 2026-12-21 + 5 business days:
    // Tue 22, Wed 23, Thu 24, (skip Dec 25 - 1. Weihnachtstag),
    // (skip Sat 26 - also 2. Weihnachtstag), (skip Sun 27),
    // Mon 28, Tue 29
    // = Tuesday 2026-12-29
    const dec21 = new Date(2026, 11, 21, 12, 0, 0);
    const result = calculateFremdgeldDeadline(dec21, 'NW');
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(29);
  });

  it('should handle Allerheiligen (Nov 1) in NRW', () => {
    // Allerheiligen is a holiday in NRW but not in e.g. Berlin
    // 2026: Nov 1 = Sunday -> no additional effect
    // 2025: Nov 1 = Saturday -> no additional effect
    // Let's test a year where Nov 1 is a weekday: Not easily testable with fixed years,
    // but we can verify that isBusinessDay returns false for Nov 1 in NRW
    // 2024: Nov 1 = Friday
    const nov1_2024 = new Date(2024, 10, 1, 12, 0, 0);
    expect(isBusinessDay(nov1_2024, 'NW')).toBe(false);
  });

  // ─── Cross-Month Boundary ────────────────────────────────────────────────

  it('should handle month boundary correctly', () => {
    // Wednesday 2026-01-28 + 5 business days:
    // Thu 29, Fri 30, (skip Sat 31 - is Saturday? No, Jan has 31 days)
    // Actually: Thu 29, Fri 30, (skip Sat 31? Jan 31 2026 is Saturday)
    // (skip Sun Feb 1), Mon Feb 2, Tue Feb 3, Wed Feb 4
    // = Wednesday 2026-02-04
    const jan28 = new Date(2026, 0, 28, 12, 0, 0);
    const result = calculateFremdgeldDeadline(jan28);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });

  // ─── Different Bundesland ────────────────────────────────────────────────

  it('should use NW as default Bundesland', () => {
    const date = new Date(2026, 0, 5, 12, 0, 0);
    const resultDefault = calculateFremdgeldDeadline(date);
    const resultNW = calculateFremdgeldDeadline(date, 'NW');
    expect(resultDefault.getTime()).toBe(resultNW.getTime());
  });
});

describe('countRemainingBusinessDays', () => {
  it('should return 0 for today', () => {
    const today = new Date();
    const todayNoon = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12, 0, 0,
    );
    expect(countRemainingBusinessDays(todayNoon)).toBe(0);
  });

  it('should return negative for past deadlines', () => {
    // Far in the past
    const pastDate = new Date(2020, 0, 6, 12, 0, 0); // Monday
    const result = countRemainingBusinessDays(pastDate);
    expect(result).toBeLessThan(0);
  });

  it('should return positive for future deadlines', () => {
    // A few weeks in the future (avoid huge year ranges that cause slow iteration)
    const today = new Date();
    const futureDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 30,
      12, 0, 0,
    );
    const result = countRemainingBusinessDays(futureDate);
    expect(result).toBeGreaterThan(0);
  });
});

describe('classifyDringlichkeit', () => {
  it('should classify > 3 days as normal', () => {
    expect(classifyDringlichkeit(5)).toBe('normal');
    expect(classifyDringlichkeit(4)).toBe('normal');
    expect(classifyDringlichkeit(10)).toBe('normal');
  });

  it('should classify 1-3 days as warnung', () => {
    expect(classifyDringlichkeit(3)).toBe('warnung');
    expect(classifyDringlichkeit(2)).toBe('warnung');
    expect(classifyDringlichkeit(1)).toBe('warnung');
  });

  it('should classify 0 days as kritisch', () => {
    expect(classifyDringlichkeit(0)).toBe('kritisch');
  });

  it('should classify negative days as ueberfaellig', () => {
    expect(classifyDringlichkeit(-1)).toBe('ueberfaellig');
    expect(classifyDringlichkeit(-5)).toBe('ueberfaellig');
    expect(classifyDringlichkeit(-100)).toBe('ueberfaellig');
  });
});

describe('isBusinessDay', () => {
  it('should return false for Saturday', () => {
    // 2026-01-03 = Saturday
    expect(isBusinessDay(new Date(2026, 0, 3))).toBe(false);
  });

  it('should return false for Sunday', () => {
    // 2026-01-04 = Sunday
    expect(isBusinessDay(new Date(2026, 0, 4))).toBe(false);
  });

  it('should return true for a regular Monday', () => {
    // 2026-01-05 = Monday (no holiday)
    expect(isBusinessDay(new Date(2026, 0, 5))).toBe(true);
  });

  it('should return false for Neujahr', () => {
    // 2026-01-01 = Neujahr (Thursday)
    expect(isBusinessDay(new Date(2026, 0, 1), 'NW')).toBe(false);
  });

  it('should return false for Weihnachten', () => {
    // 2026-12-25 = 1. Weihnachtstag (Friday)
    expect(isBusinessDay(new Date(2026, 11, 25), 'NW')).toBe(false);
  });
});

describe('Anderkonto threshold', () => {
  it('should have the correct threshold value', () => {
    expect(ANDERKONTO_SCHWELLE).toBe(15000);
  });
});
