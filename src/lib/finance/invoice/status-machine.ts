// Invoice Status Machine
// Enforces valid status transitions and executes side effects
// Flow: ENTWURF -> GESTELLT -> BEZAHLT -> (terminal)
//       ENTWURF -> STORNIERT (simple cancel)
//       GESTELLT -> STORNIERT (creates Stornorechnung)
//       GESTELLT -> MAHNUNG (tracks dunning level)

import { RechnungStatus, MahnStufe } from '@prisma/client';
import { getNextInvoiceNumber } from './nummernkreis';
import type { TransitionResult } from './types';
import type { PrismaTransactionClient as PrismaTransaction } from '@/lib/db';

/**
 * Valid status transitions map.
 * Key: current status, Value: set of allowed target statuses.
 */
export const VALID_TRANSITIONS: Record<RechnungStatus, Set<RechnungStatus>> = {
  [RechnungStatus.ENTWURF]: new Set([
    RechnungStatus.GESTELLT,
    RechnungStatus.STORNIERT,
  ]),
  [RechnungStatus.GESTELLT]: new Set([
    RechnungStatus.BEZAHLT,
    RechnungStatus.STORNIERT,
    RechnungStatus.MAHNUNG,
  ]),
  [RechnungStatus.BEZAHLT]: new Set([]),
  [RechnungStatus.MAHNUNG]: new Set([
    RechnungStatus.BEZAHLT,
    RechnungStatus.STORNIERT,
  ]),
  [RechnungStatus.STORNIERT]: new Set([]),
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  from: RechnungStatus,
  to: RechnungStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Transition an invoice to a new status with side effects.
 *
 * Side effects per transition:
 * - ENTWURF -> GESTELLT: Lock rechnungsdatum, calculate faelligAm from zahlungszielTage
 * - GESTELLT -> BEZAHLT: Set bezahltAm, calculate restBetrag
 * - GESTELLT -> STORNIERT: Create Stornorechnung with GS-number
 * - GESTELLT -> MAHNUNG: Create Mahnung record, update mahnStufe
 * - ENTWURF -> STORNIERT: Simple status change (no Stornorechnung needed)
 * - MAHNUNG -> BEZAHLT: Set bezahltAm
 * - MAHNUNG -> STORNIERT: Create Stornorechnung
 *
 * @param tx - Prisma transaction
 * @param rechnungId - Invoice ID
 * @param targetStatus - Target status
 * @param userId - User performing the transition
 * @param stornoPattern - Pattern for Storno numbers (from Kanzlei settings)
 */
export async function transitionInvoiceStatus(
  tx: PrismaTransaction,
  rechnungId: string,
  targetStatus: RechnungStatus,
  userId: string,
  stornoPattern?: string,
): Promise<TransitionResult> {
  // Load current invoice
  const rechnung = await tx.rechnung.findUnique({
    where: { id: rechnungId },
    include: { akte: { select: { kanzleiId: true } } },
  });

  if (!rechnung) {
    return { success: false, error: 'Rechnung nicht gefunden' };
  }

  const currentStatus = rechnung.status;

  // Validate transition
  if (!isValidTransition(currentStatus, targetStatus)) {
    return {
      success: false,
      error: `Ungueltige Statusaenderung: ${currentStatus} -> ${targetStatus}`,
    };
  }

  const sideEffects: TransitionResult['sideEffects'] = {};
  const now = new Date();

  // Execute transition-specific logic
  switch (`${currentStatus}->${targetStatus}`) {
    case 'ENTWURF->GESTELLT': {
      // Lock Rechnungsdatum and calculate faelligAm
      const faelligAm = new Date(now);
      faelligAm.setDate(faelligAm.getDate() + rechnung.zahlungszielTage);

      await tx.rechnung.update({
        where: { id: rechnungId },
        data: {
          status: RechnungStatus.GESTELLT,
          rechnungsdatum: now,
          faelligAm,
          restBetrag: rechnung.betragBrutto,
        },
      });
      break;
    }

    case 'GESTELLT->BEZAHLT':
    case 'MAHNUNG->BEZAHLT': {
      await tx.rechnung.update({
        where: { id: rechnungId },
        data: {
          status: RechnungStatus.BEZAHLT,
          bezahltAm: now,
          restBetrag: 0,
        },
      });
      break;
    }

    case 'GESTELLT->STORNIERT':
    case 'MAHNUNG->STORNIERT': {
      // Create Stornorechnung with own GS-number
      const year = now.getFullYear();
      const stornoNr = await getNextInvoiceNumber(
        tx,
        'GS',
        year,
        stornoPattern,
      );

      const stornoRechnung = await tx.rechnung.create({
        data: {
          akteId: rechnung.akteId,
          rechnungsnummer: stornoNr,
          typ: rechnung.typ,
          status: RechnungStatus.STORNIERT,
          betragNetto: rechnung.betragNetto,
          mwstSatz: rechnung.mwstSatz,
          betragBrutto: rechnung.betragBrutto,
          positionen: rechnung.positionen as any,
          ustSummary: rechnung.ustSummary as any,
          stornoVon: rechnung.rechnungsnummer,
          empfaengerId: rechnung.empfaengerId,
          zahlungszielTage: rechnung.zahlungszielTage,
          rechnungsdatum: now,
          notizen: `Stornierung von ${rechnung.rechnungsnummer}`,
        },
      });

      // Mark original as storniert
      await tx.rechnung.update({
        where: { id: rechnungId },
        data: {
          status: RechnungStatus.STORNIERT,
          restBetrag: 0,
        },
      });

      sideEffects.stornoRechnungId = stornoRechnung.id;
      break;
    }

    case 'GESTELLT->MAHNUNG': {
      // Determine next Mahnstufe
      const currentStufe = rechnung.mahnStufe;
      const nextStufe = getNextMahnStufe(currentStufe);

      // Create Mahnung record
      const mahnung = await tx.mahnung.create({
        data: {
          rechnungId,
          stufe: nextStufe,
          datum: now,
        },
      });

      await tx.rechnung.update({
        where: { id: rechnungId },
        data: {
          status: RechnungStatus.MAHNUNG,
          mahnStufe: nextStufe,
          mahnDatum: now,
        },
      });

      sideEffects.mahnungId = mahnung.id;
      break;
    }

    case 'ENTWURF->STORNIERT': {
      // Simple status change - no Stornorechnung needed for drafts
      await tx.rechnung.update({
        where: { id: rechnungId },
        data: {
          status: RechnungStatus.STORNIERT,
        },
      });
      break;
    }
  }

  // Audit log
  await tx.auditLog.create({
    data: {
      userId,
      akteId: rechnung.akteId,
      aktion: 'RECHNUNG_STATUS_GEAENDERT',
      details: {
        rechnungId,
        rechnungsnummer: rechnung.rechnungsnummer,
        von: currentStatus,
        nach: targetStatus,
        ...(sideEffects.stornoRechnungId && {
          stornoRechnungId: sideEffects.stornoRechnungId,
        }),
        ...(sideEffects.mahnungId && {
          mahnungId: sideEffects.mahnungId,
        }),
      },
    },
  });

  return { success: true, sideEffects };
}

/**
 * Determine the next Mahnstufe in the dunning sequence.
 */
function getNextMahnStufe(current: MahnStufe | null): MahnStufe {
  const sequence: MahnStufe[] = [
    MahnStufe.ERINNERUNG,
    MahnStufe.ERSTE_MAHNUNG,
    MahnStufe.ZWEITE_MAHNUNG,
    MahnStufe.DRITTE_MAHNUNG,
  ];

  if (!current) return MahnStufe.ERINNERUNG;

  const currentIndex = sequence.indexOf(current);
  if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
    return MahnStufe.DRITTE_MAHNUNG;
  }

  return sequence[currentIndex + 1];
}
