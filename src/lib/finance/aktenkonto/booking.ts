// Aktenkonto Booking Logic
// Append-only booking creation, Storno workflow, and auto-booking from invoices
// GoBD-compliant: no edits or deletions, only new entries and Stornobuchungen

import { BuchungsTyp, KontoTyp } from '@prisma/client';
import { calculateFremdgeldDeadline } from './fremdgeld';
import type { BookingInput, StornoInput } from './types';
import type { PrismaTransactionClient as PrismaTransaction } from '@/lib/db';

/**
 * Create a new Aktenkonto booking (append-only).
 *
 * Validates:
 * - Buchungsperiode for the booking month is not GESPERRT
 * - If FREMDGELD: calculates and stores fremdgeldFrist (5 business days)
 * - Audit trail via AuditLog
 *
 * @param tx - Prisma transaction context
 * @param input - Booking input data
 * @returns The created booking record
 */
export async function createBooking(
  tx: PrismaTransaction,
  input: BookingInput,
) {
  const buchungsdatum = input.buchungsdatum ?? new Date();

  // Check if the booking period is locked
  const akte = await tx.akte.findUnique({
    where: { id: input.akteId },
    select: { kanzleiId: true },
  });

  if (!akte) {
    throw new Error('Akte nicht gefunden');
  }

  const jahr = buchungsdatum.getFullYear();
  const monat = buchungsdatum.getMonth() + 1;

  // Check period lock only if Akte has a Kanzlei assigned
  let periode: { id: string; status: string } | null = null;
  if (akte.kanzleiId) {
    periode = await tx.buchungsperiode.findUnique({
      where: {
        kanzleiId_jahr_monat: {
          kanzleiId: akte.kanzleiId,
          jahr,
          monat,
        },
      },
    });
  }

  if (periode?.status === 'GESPERRT') {
    throw new Error(
      `Buchungsperiode ${monat.toString().padStart(2, '0')}/${jahr} ist gesperrt. Keine Buchungen moeglich.`,
    );
  }

  // Calculate Fremdgeld deadline if applicable
  let fremdgeldFrist: Date | null = null;
  if (input.buchungstyp === BuchungsTyp.FREMDGELD && input.betrag > 0) {
    fremdgeldFrist = calculateFremdgeldDeadline(buchungsdatum);
  }

  // Determine signed betrag: AUSGABE and AUSLAGE are negative in the ledger
  const signedBetrag =
    input.buchungstyp === BuchungsTyp.AUSGABE ||
    input.buchungstyp === BuchungsTyp.AUSLAGE
      ? -Math.abs(input.betrag)
      : Math.abs(input.betrag);

  // Create the booking entry
  const buchung = await tx.aktenKontoBuchung.create({
    data: {
      akteId: input.akteId,
      buchungstyp: input.buchungstyp,
      betrag: signedBetrag,
      verwendungszweck: input.verwendungszweck,
      buchungsdatum,
      rechnungId: input.rechnungId ?? null,
      bankTransaktionId: input.bankTransaktionId ?? null,
      dokumentId: input.dokumentId ?? null,
      kostenstelle: input.kostenstelle ?? null,
      konto: input.konto ?? KontoTyp.GESCHAEFT,
      gebuchtVon: input.gebuchtVon,
      fremdgeldFrist,
      periodeId: periode?.id ?? null,
    },
  });

  // Audit log
  await tx.auditLog.create({
    data: {
      userId: input.gebuchtVon,
      akteId: input.akteId,
      aktion: 'AKTENKONTO_BUCHUNG_ERSTELLT',
      details: {
        buchungId: buchung.id,
        buchungstyp: input.buchungstyp,
        betrag: signedBetrag,
        verwendungszweck: input.verwendungszweck,
        ...(fremdgeldFrist && { fremdgeldFrist: fremdgeldFrist.toISOString() }),
      },
    },
  });

  return buchung;
}

/**
 * Create a Storno (reversal) booking for an existing entry.
 *
 * Creates a new booking with negated amount, linking to the original via stornoVon.
 * The original booking is never modified (append-only / GoBD-compliant).
 *
 * @param tx - Prisma transaction context
 * @param input - Storno input with original booking ID and reason
 * @returns The created Storno booking
 */
export async function stornoBooking(
  tx: PrismaTransaction,
  input: StornoInput,
) {
  // Load the original booking
  const original = await tx.aktenKontoBuchung.findUnique({
    where: { id: input.originalId },
  });

  if (!original) {
    throw new Error('Originalbuchung nicht gefunden');
  }

  // Check that the original hasn't already been reversed
  const existingStorno = await tx.aktenKontoBuchung.findFirst({
    where: { stornoVon: input.originalId },
  });

  if (existingStorno) {
    throw new Error('Diese Buchung wurde bereits storniert');
  }

  // Create the negating entry
  const stornoBuchung = await tx.aktenKontoBuchung.create({
    data: {
      akteId: original.akteId,
      buchungstyp: original.buchungstyp,
      betrag: original.betrag.negated(), // Prisma Decimal negation
      verwendungszweck: `Storno: ${original.verwendungszweck}`,
      buchungsdatum: new Date(),
      stornoVon: original.id,
      stornoGrund: input.grund,
      gebuchtVon: input.userId,
      konto: original.konto,
      kostenstelle: original.kostenstelle,
      rechnungId: original.rechnungId,
    },
  });

  // Audit log
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      akteId: original.akteId,
      aktion: 'AKTENKONTO_STORNO',
      details: {
        stornoBuchungId: stornoBuchung.id,
        originalBuchungId: original.id,
        originalVerwendungszweck: original.verwendungszweck,
        grund: input.grund,
        betrag: stornoBuchung.betrag.toNumber(),
      },
    },
  });

  return stornoBuchung;
}

/**
 * Auto-book an Aktenkonto entry when an invoice status transitions.
 *
 * Per CONTEXT decision: "Invoice -> Aktenkonto: auto-book on status change"
 * - GESTELLT: create EINNAHME booking (Forderung) with positive betrag
 * - BEZAHLT: no additional booking (Forderung already booked at GESTELLT)
 * - STORNIERT: create Stornobuchung for the original Forderung booking
 *
 * @param tx - Prisma transaction context
 * @param rechnungId - Invoice ID
 * @param action - Status transition action name
 * @param userId - User performing the transition
 */
export async function autoBookFromInvoice(
  tx: PrismaTransaction,
  rechnungId: string,
  action: string,
  userId: string,
) {
  const rechnung = await tx.rechnung.findUnique({
    where: { id: rechnungId },
    select: {
      id: true,
      akteId: true,
      rechnungsnummer: true,
      betragBrutto: true,
    },
  });

  if (!rechnung) return;

  switch (action) {
    case 'stellen': {
      // Create EINNAHME booking (open receivable / Forderung)
      await createBooking(tx, {
        akteId: rechnung.akteId,
        buchungstyp: BuchungsTyp.EINNAHME,
        betrag: rechnung.betragBrutto.toNumber(),
        verwendungszweck: `Forderung: Rechnung ${rechnung.rechnungsnummer}`,
        rechnungId: rechnung.id,
        gebuchtVon: userId,
      });
      break;
    }

    case 'stornieren': {
      // Find the original Forderung booking for this invoice
      const originalBuchung = await tx.aktenKontoBuchung.findFirst({
        where: {
          rechnungId: rechnung.id,
          buchungstyp: BuchungsTyp.EINNAHME,
          stornoVon: null, // Not itself a Storno
        },
        orderBy: { createdAt: 'desc' },
      });

      if (originalBuchung) {
        await stornoBooking(tx, {
          originalId: originalBuchung.id,
          grund: `Rechnung ${rechnung.rechnungsnummer} storniert`,
          userId,
        });
      }
      break;
    }

    // BEZAHLT: no additional booking needed - Forderung was already created at GESTELLT
    default:
      break;
  }
}
