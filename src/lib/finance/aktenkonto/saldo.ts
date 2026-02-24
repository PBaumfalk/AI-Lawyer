// Aktenkonto Saldo (Balance) Calculations
// Per-case balance breakdown and running balance computation

import { BuchungsTyp, RechnungStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { SaldoResult } from './types';

/**
 * Calculate the full balance breakdown for a case's Aktenkonto.
 *
 * Aggregates all bookings by type and computes:
 * - gesamtSaldo: net of all bookings
 * - einnahmen: sum of EINNAHME bookings
 * - ausgaben: sum of AUSGABE bookings (absolute value)
 * - fremdgeld: net of all FREMDGELD bookings
 * - auslagen: sum of AUSLAGE bookings (absolute value)
 * - offeneForderungen: sum of GESTELLT/MAHNUNG invoices for this case
 *
 * @param akteId - The case ID
 * @returns Balance breakdown
 */
export async function calculateSaldo(akteId: string): Promise<SaldoResult> {
  const buchungen = await prisma.aktenKontoBuchung.findMany({
    where: { akteId },
    select: { buchungstyp: true, betrag: true },
  });

  let einnahmen = 0;
  let ausgaben = 0;
  let fremdgeld = 0;
  let auslagen = 0;

  for (const b of buchungen) {
    const betrag = b.betrag.toNumber();
    switch (b.buchungstyp) {
      case BuchungsTyp.EINNAHME:
        einnahmen += betrag;
        break;
      case BuchungsTyp.AUSGABE:
        ausgaben += betrag; // Already negative in the ledger
        break;
      case BuchungsTyp.FREMDGELD:
        fremdgeld += betrag;
        break;
      case BuchungsTyp.AUSLAGE:
        auslagen += betrag; // Already negative in the ledger
        break;
    }
  }

  // Open receivables: invoices that are GESTELLT or MAHNUNG (not yet paid)
  const offeneRechnungen = await prisma.rechnung.findMany({
    where: {
      akteId,
      status: { in: [RechnungStatus.GESTELLT, RechnungStatus.MAHNUNG] },
    },
    select: { restBetrag: true },
  });

  const offeneForderungen = offeneRechnungen.reduce(
    (sum, r) => sum + (r.restBetrag?.toNumber() ?? 0),
    0,
  );

  // Total saldo: einnahmen (positive) + ausgaben (negative) + auslagen (negative)
  // Fremdgeld is tracked separately as it's trust money
  const gesamtSaldo = einnahmen + ausgaben + auslagen;

  return {
    gesamtSaldo: round2(gesamtSaldo),
    einnahmen: round2(einnahmen),
    ausgaben: round2(Math.abs(ausgaben)),
    fremdgeld: round2(fremdgeld),
    auslagen: round2(Math.abs(auslagen)),
    offeneForderungen: round2(offeneForderungen),
  };
}

/**
 * Calculate the net Fremdgeld balance for a case.
 *
 * Sums all FREMDGELD bookings including Storno entries (which are negative).
 * This represents the current Fremdgeld liability.
 *
 * @param akteId - The case ID
 * @returns Net Fremdgeld balance
 */
export async function calculateFremdgeldSaldo(akteId: string): Promise<number> {
  const buchungen = await prisma.aktenKontoBuchung.findMany({
    where: {
      akteId,
      buchungstyp: BuchungsTyp.FREMDGELD,
    },
    select: { betrag: true },
  });

  const total = buchungen.reduce((sum, b) => sum + b.betrag.toNumber(), 0);
  return round2(total);
}

/**
 * Get chronological bookings with running balance computed from cumulative sum.
 *
 * Returns all bookings for a case sorted by date, with each entry annotated
 * with the running balance up to and including that entry.
 *
 * @param akteId - The case ID
 * @returns Array of bookings with laufenderSaldo field
 */
export async function calculateRunningBalance(
  akteId: string,
): Promise<Array<{
  id: string;
  buchungstyp: BuchungsTyp;
  betrag: number;
  verwendungszweck: string;
  buchungsdatum: Date;
  belegnummer: string | null;
  gebuchtVon: string | null;
  stornoVon: string | null;
  stornoGrund: string | null;
  rechnungId: string | null;
  kostenstelle: string | null;
  konto: string;
  fremdgeldFrist: Date | null;
  createdAt: Date;
  laufenderSaldo: number;
}>> {
  const buchungen = await prisma.aktenKontoBuchung.findMany({
    where: { akteId },
    orderBy: [{ buchungsdatum: 'asc' }, { createdAt: 'asc' }],
  });

  let runningSaldo = 0;

  return buchungen.map((b) => {
    const betrag = b.betrag.toNumber();
    runningSaldo += betrag;

    return {
      id: b.id,
      buchungstyp: b.buchungstyp,
      betrag,
      verwendungszweck: b.verwendungszweck,
      buchungsdatum: b.buchungsdatum,
      belegnummer: b.belegnummer,
      gebuchtVon: b.gebuchtVon,
      stornoVon: b.stornoVon,
      stornoGrund: b.stornoGrund,
      rechnungId: b.rechnungId,
      kostenstelle: b.kostenstelle,
      konto: b.konto,
      fremdgeldFrist: b.fremdgeldFrist,
      createdAt: b.createdAt,
      laufenderSaldo: round2(runningSaldo),
    };
  });
}

/**
 * Round to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
