// Fremdgeld Compliance Checks
// 5-Werktage forwarding deadline (SS 43a BRAO) and 15k Anderkonto threshold
// Uses feiertagejs for German holidays (NRW default)

import { istFeiertag } from '@/lib/fristen/feiertage';
import type { BundeslandCode } from '@/lib/fristen/types';
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
  return istFeiertag(date, bundesland as BundeslandCode);
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

/** Minimal booking shape needed to determine open Fremdgeld receipts. */
export interface FremdgeldBuchungLite {
  id: string;
  akteId: string;
  betrag: number;
  buchungsdatum: Date;
  createdAt?: Date;
  stornoVon: string | null;
  fremdgeldFrist: Date | null;
}

export interface OffenerFremdgeldEingang {
  buchung: FremdgeldBuchungLite;
  /** Part of the receipt not yet forwarded */
  offen: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Determine which Fremdgeld receipts of ONE case are still not forwarded.
 *
 * - Positive FREMDGELD bookings are receipts (Eingaenge), negative ones are
 *   forwardings (Weiterleitungen).
 * - Storno entries and the bookings they reverse are ignored entirely.
 * - Forwardings settle receipts oldest first (FIFO); a receipt stays open with
 *   its uncovered remainder until forwardings cover it completely.
 */
export function ermittleOffeneFremdgeldEingaenge(
  buchungen: FremdgeldBuchungLite[],
): OffenerFremdgeldEingang[] {
  const reversed = new Set(buchungen.map((b) => b.stornoVon).filter(Boolean));
  const aktiv = buchungen.filter((b) => b.stornoVon === null && !reversed.has(b.id));

  const eingaenge = aktiv
    .filter((b) => b.betrag > 0)
    .sort(
      (a, b) =>
        a.buchungsdatum.getTime() - b.buchungsdatum.getTime() ||
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );

  let weitergeleitet = round2(
    aktiv.filter((b) => b.betrag < 0).reduce((sum, b) => sum - b.betrag, 0),
  );

  const offen: OffenerFremdgeldEingang[] = [];
  for (const eingang of eingaenge) {
    const deckung = Math.min(weitergeleitet, eingang.betrag);
    weitergeleitet = round2(weitergeleitet - deckung);
    const rest = round2(eingang.betrag - deckung);
    if (rest > 0) offen.push({ buchung: eingang, offen: rest });
  }
  return offen;
}

function toAlert(e: OffenerFremdgeldEingang): FremdgeldAlert | null {
  if (!e.buchung.fremdgeldFrist) return null;
  const verbleibendeTage = countRemainingBusinessDays(e.buchung.fremdgeldFrist);
  return {
    buchungId: e.buchung.id,
    akteId: e.buchung.akteId,
    betrag: e.buchung.betrag,
    offenerBetrag: e.offen,
    eingangsDatum: e.buchung.buchungsdatum,
    frist: e.buchung.fremdgeldFrist,
    verbleibendeTage,
    dringlichkeit: classifyDringlichkeit(verbleibendeTage),
  };
}

async function loadFremdgeldBuchungen(where: { akteId?: string }): Promise<FremdgeldBuchungLite[]> {
  const rows = await prisma.aktenKontoBuchung.findMany({
    where: { ...where, buchungstyp: BuchungsTyp.FREMDGELD },
    select: {
      id: true,
      akteId: true,
      betrag: true,
      buchungsdatum: true,
      createdAt: true,
      stornoVon: true,
      fremdgeldFrist: true,
    },
  });
  return rows.map((r) => ({ ...r, betrag: r.betrag.toNumber() }));
}

/**
 * Check Fremdgeld compliance for a specific case.
 *
 * Alerts for every receipt that is not yet fully forwarded (see
 * ermittleOffeneFremdgeldEingaenge) and the 15k EUR Anderkonto threshold.
 *
 * @param akteId - The case ID to check
 * @returns Compliance result with alerts and optional Anderkonto alert
 */
export async function checkFremdgeldCompliance(
  akteId: string,
): Promise<FremdgeldComplianceResult> {
  const buchungen = await loadFremdgeldBuchungen({ akteId });

  const alerts = ermittleOffeneFremdgeldEingaenge(buchungen)
    .map(toAlert)
    .filter((a): a is FremdgeldAlert => a !== null);

  // Anderkonto threshold: net Fremdgeld held (receipts minus forwardings, Storno included)
  const totalFremdgeld = round2(buchungen.reduce((sum, b) => sum + b.betrag, 0));

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
  const buchungen = await loadFremdgeldBuchungen({});

  const byAkte = new Map<string, FremdgeldBuchungLite[]>();
  for (const b of buchungen) {
    const list = byAkte.get(b.akteId) ?? [];
    list.push(b);
    byAkte.set(b.akteId, list);
  }

  const alerts: FremdgeldAlert[] = [];
  for (const list of Array.from(byAkte.values())) {
    for (const offen of ermittleOffeneFremdgeldEingaenge(list)) {
      const alert = toAlert(offen);
      if (alert && alert.dringlichkeit !== 'normal') alerts.push(alert);
    }
  }
  return alerts.sort((a, b) => a.frist.getTime() - b.frist.getTime());
}
