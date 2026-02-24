// Invoice Matching Algorithm
// Matches bank transactions to invoices with confidence scoring
// Used by the bank reconciliation workflow

import { prisma } from '@/lib/db';
import { RechnungStatus } from '@prisma/client';
import type { MatchResult, MatchSuggestion } from './types';

/**
 * Match unmatched bank transactions to open invoices.
 *
 * Scoring algorithm:
 * - Rechnungsnummer found in Verwendungszweck: confidence 0.95
 * - Exact betrag match (within 0.01 EUR): confidence 0.7
 * - Mandant name found in absenderEmpfaenger: confidence 0.5
 * - Combined score: max of individual scores (not sum)
 *
 * @param transaktionIds - Optional filter: only match these transaction IDs
 * @returns Array of MatchResults with suggestions sorted by confidence
 */
export async function matchTransactions(
  transaktionIds?: string[],
): Promise<MatchResult[]> {
  // Load unmatched transactions
  const where: Record<string, any> = { zugeordnet: false };
  if (transaktionIds?.length) {
    where.id = { in: transaktionIds };
  }

  const transaktionen = await prisma.bankTransaktion.findMany({
    where,
    orderBy: { buchungsdatum: 'desc' },
  });

  if (transaktionen.length === 0) return [];

  // Load open invoices (GESTELLT = sent but not paid)
  const rechnungen = await prisma.rechnung.findMany({
    where: {
      status: { in: [RechnungStatus.GESTELLT] },
    },
    include: {
      akte: {
        include: {
          beteiligte: {
            include: {
              kontakt: { select: { vorname: true, nachname: true, firma: true } },
            },
            where: { rolle: 'MANDANT' },
          },
        },
      },
    },
  });

  if (rechnungen.length === 0) {
    return transaktionen.map((t) => ({
      transaktionId: t.id,
      transaktion: {
        buchungsdatum: t.buchungsdatum,
        betrag: t.betrag.toNumber(),
        verwendungszweck: t.verwendungszweck,
        absenderEmpfaenger: t.absenderEmpfaenger,
      },
      matches: [],
    }));
  }

  const results: MatchResult[] = [];

  for (const tx of transaktionen) {
    const txBetrag = tx.betrag.toNumber();
    const txVerwendungszweck = tx.verwendungszweck.toLowerCase();
    const txSender = (tx.absenderEmpfaenger ?? '').toLowerCase();
    const suggestions: MatchSuggestion[] = [];

    for (const rechnung of rechnungen) {
      const matchReasons: string[] = [];
      let maxConfidence = 0;

      // 1. Check Rechnungsnummer in Verwendungszweck (confidence 0.95)
      const rNr = rechnung.rechnungsnummer.toLowerCase();
      if (txVerwendungszweck.includes(rNr)) {
        matchReasons.push(`Rechnungsnummer "${rechnung.rechnungsnummer}" im Verwendungszweck`);
        maxConfidence = Math.max(maxConfidence, 0.95);
      }

      // 2. Check exact amount match within 0.01 EUR (confidence 0.7)
      const rBetrag = rechnung.betragBrutto.toNumber();
      if (Math.abs(txBetrag - rBetrag) < 0.01) {
        matchReasons.push(`Betrag ${rBetrag.toFixed(2)} EUR stimmt ueberein`);
        maxConfidence = Math.max(maxConfidence, 0.7);
      }

      // 3. Check Mandant name in sender/recipient (confidence 0.5)
      const mandanten = rechnung.akte.beteiligte
        .map((b) => {
          const k = b.kontakt;
          // Build display name from Kontakt fields
          const displayName = k.firma
            ? k.firma
            : [k.vorname, k.nachname].filter(Boolean).join(' ');
          return displayName.toLowerCase();
        })
        .filter((n) => n.length > 0);

      for (const mandantName of mandanten) {
        if (txSender.includes(mandantName) || mandantName.includes(txSender)) {
          const firstKontakt = rechnung.akte.beteiligte[0]?.kontakt;
          const displayName = firstKontakt?.firma
            ?? [firstKontakt?.vorname, firstKontakt?.nachname].filter(Boolean).join(' ');
          matchReasons.push(`Mandant "${displayName}" als Absender`);
          maxConfidence = Math.max(maxConfidence, 0.5);
          break;
        }
      }

      if (maxConfidence > 0) {
        suggestions.push({
          rechnungId: rechnung.id,
          rechnungsnummer: rechnung.rechnungsnummer,
          rechnungBetrag: rechnung.betragBrutto.toNumber(),
          confidence: maxConfidence,
          matchReasons,
        });
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    results.push({
      transaktionId: tx.id,
      transaktion: {
        buchungsdatum: tx.buchungsdatum,
        betrag: txBetrag,
        verwendungszweck: tx.verwendungszweck,
        absenderEmpfaenger: tx.absenderEmpfaenger,
      },
      matches: suggestions,
    });
  }

  return results;
}
