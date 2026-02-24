// Fremdgeld Compliance Checks
// 5-Werktage forwarding deadline (SS 43a BRAO) and 15k Anderkonto threshold
// Uses feiertagejs for German holidays (NRW default)

import * as feiertagejs from 'feiertagejs';
import { BuchungsTyp } from '@prisma/client';
import { prisma } from '@/lib/db';
import type {
  FremdgeldAlert,
  AnderkontoAlert,
  FremdgeldComplianceResult,
} from './types';
import { ANDERKONTO_SCHWELLE, DEFAULT_BUNDESLAND } from './types';

/**
 * Normalize a date to noon to avoid CET/CEST timezone issues with feiertagejs.
 * (Mirrors the pattern from src/lib/fristen/feiertage.ts)
 */
function toNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

/**
 * Check if a date is a weekend (Saturday or Sunday).
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a public holiday in the specified Bundesland.
 */
function isHoliday(date: Date, bundesland: string): boolean {
  return feiertagejs.isHoliday(toNoon(date), bundesland as any);
}

/**
 * Check if a date is a business day (not weekend, not holiday).
 */
export function isBusinessDay(date: Date, bundesland: string = DEFAULT_BUNDESLAND): boolean {
  return !isWeekend(date) && !isHoliday(date, bundesland);
}

/**
 * Add one calendar day to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate the Fremdgeld forwarding deadline (5 business days from booking date).
 *
 * Per SS 43a BRAO, Fremdgeld must be forwarded to the client within 5 Werktage.
 * Uses feiertagejs for NRW holidays (configurable via bundesland parameter).
 *
 * @param buchungsdatum - Date the Fremdgeld was received
 * @param bundesland - Two-letter Bundesland code (default: NW for NRW)
 * @returns The deadline date (5 business days after buchungsdatum)
 */
export function calculateFremdgeldDeadline(
  buchungsdatum: Date,
  bundesland: string = DEFAULT_BUNDESLAND,
): Date {
  let current = new Date(
    buchungsdatum.getFullYear(),
    buchungsdatum.getMonth(),
    buchungsdatum.getDate(),
    12, 0, 0,
  );
  let businessDaysAdded = 0;

  while (businessDaysAdded < 5) {
    current = addDays(current, 1);
    if (isBusinessDay(current, bundesland)) {
      businessDaysAdded++;
    }
  }

  return current;
}

/**
 * Count remaining business days from today until a deadline.
 * Returns negative number if deadline is past.
 */
export function countRemainingBusinessDays(
  deadline: Date,
  bundesland: string = DEFAULT_BUNDESLAND,
): number {
  const today = new Date();
  const todayNoon = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12, 0, 0,
  );
  const deadlineNoon = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
    12, 0, 0,
  );

  if (deadlineNoon.getTime() === todayNoon.getTime()) return 0;

  const isPast = deadlineNoon < todayNoon;
  const start = isPast ? deadlineNoon : todayNoon;
  const end = isPast ? todayNoon : deadlineNoon;

  let count = 0;
  let current = new Date(start);

  while (current < end) {
    current = addDays(current, 1);
    if (isBusinessDay(current, bundesland)) {
      count++;
    }
  }

  return isPast ? -count : count;
}

/**
 * Classify the urgency of a Fremdgeld alert based on remaining days.
 */
export function classifyDringlichkeit(
  verbleibendeTage: number,
): FremdgeldAlert['dringlichkeit'] {
  if (verbleibendeTage < 0) return 'ueberfaellig';
  if (verbleibendeTage === 0) return 'kritisch';
  if (verbleibendeTage <= 3) return 'warnung';
  return 'normal';
}

/**
 * Check Fremdgeld compliance for a specific case.
 *
 * Queries all FREMDGELD bookings that have not been forwarded (no matching
 * Storno entry). For each: calculates remaining days and classifies urgency.
 * Also checks the 15k EUR Anderkonto threshold.
 *
 * @param akteId - The case ID to check
 * @returns Compliance result with alerts and optional Anderkonto alert
 */
export async function checkFremdgeldCompliance(
  akteId: string,
): Promise<FremdgeldComplianceResult> {
  // Get all FREMDGELD bookings for this case that are positive (incoming)
  // and have not been reversed (no Storno pointing at them)
  const fremdgeldBuchungen = await prisma.aktenKontoBuchung.findMany({
    where: {
      akteId,
      buchungstyp: BuchungsTyp.FREMDGELD,
      betrag: { gt: 0 },
      stornoVon: null, // Not a Storno entry itself
    },
    orderBy: { buchungsdatum: 'asc' },
  });

  // Find which ones have been reversed (Storno entries pointing at them)
  const stornoEntries = await prisma.aktenKontoBuchung.findMany({
    where: {
      akteId,
      stornoVon: { not: null },
    },
    select: { stornoVon: true },
  });

  const reversedIds = new Set(
    stornoEntries.map((s) => s.stornoVon).filter(Boolean),
  );

  // Filter to only non-reversed FREMDGELD bookings
  const activeFremdgeld = fremdgeldBuchungen.filter(
    (b) => !reversedIds.has(b.id),
  );

  // Build alerts
  const alerts: FremdgeldAlert[] = [];

  for (const buchung of activeFremdgeld) {
    if (!buchung.fremdgeldFrist) continue;

    const verbleibendeTage = countRemainingBusinessDays(buchung.fremdgeldFrist);
    const dringlichkeit = classifyDringlichkeit(verbleibendeTage);

    alerts.push({
      buchungId: buchung.id,
      akteId: buchung.akteId,
      betrag: buchung.betrag.toNumber(),
      eingangsDatum: buchung.buchungsdatum,
      frist: buchung.fremdgeldFrist,
      verbleibendeTage,
      dringlichkeit,
    });
  }

  // Check Anderkonto threshold
  // Sum ALL Fremdgeld bookings (including Storno, which are negative)
  const allFremdgeld = await prisma.aktenKontoBuchung.findMany({
    where: {
      akteId,
      buchungstyp: BuchungsTyp.FREMDGELD,
    },
    select: { betrag: true },
  });

  const totalFremdgeld = allFremdgeld.reduce(
    (sum, b) => sum + b.betrag.toNumber(),
    0,
  );

  let anderkontoAlert: AnderkontoAlert | undefined;
  if (totalFremdgeld >= ANDERKONTO_SCHWELLE) {
    anderkontoAlert = {
      akteId,
      totalFremdgeld,
      schwelle: ANDERKONTO_SCHWELLE,
      ueberschritten: true,
    };
  }

  return { alerts, anderkontoAlert };
}

/**
 * Get all active Fremdgeld alerts across all cases.
 *
 * Used by the dashboard widget and BullMQ cron job.
 * Returns only alerts with dringlichkeit warnung, kritisch, or ueberfaellig.
 *
 * @returns Array of active Fremdgeld alerts
 */
export async function getFremdgeldAlerts(): Promise<FremdgeldAlert[]> {
  // Get all FREMDGELD bookings with a frist that have not been reversed
  const fremdgeldBuchungen = await prisma.aktenKontoBuchung.findMany({
    where: {
      buchungstyp: BuchungsTyp.FREMDGELD,
      betrag: { gt: 0 },
      stornoVon: null,
      fremdgeldFrist: { not: null },
    },
    orderBy: { fremdgeldFrist: 'asc' },
  });

  // Find all Storno entries globally
  const stornoEntries = await prisma.aktenKontoBuchung.findMany({
    where: {
      buchungstyp: BuchungsTyp.FREMDGELD,
      stornoVon: { not: null },
    },
    select: { stornoVon: true },
  });

  const reversedIds = new Set(
    stornoEntries.map((s) => s.stornoVon).filter(Boolean),
  );

  const alerts: FremdgeldAlert[] = [];

  for (const buchung of fremdgeldBuchungen) {
    if (reversedIds.has(buchung.id)) continue;
    if (!buchung.fremdgeldFrist) continue;

    const verbleibendeTage = countRemainingBusinessDays(buchung.fremdgeldFrist);
    const dringlichkeit = classifyDringlichkeit(verbleibendeTage);

    // Only return actionable alerts (not "normal")
    if (dringlichkeit === 'normal') continue;

    alerts.push({
      buchungId: buchung.id,
      akteId: buchung.akteId,
      betrag: buchung.betrag.toNumber(),
      eingangsDatum: buchung.buchungsdatum,
      frist: buchung.fremdgeldFrist,
      verbleibendeTage,
      dringlichkeit,
    });
  }

  return alerts;
}
