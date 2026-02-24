// Bank Transaction Matching API
// GET: List unmatched transactions with suggested invoice matches
// POST: Confirm a match (cascades: bank -> invoice paid -> Aktenkonto booking)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { BuchungsTyp } from '@prisma/client';
import { matchTransactions } from '@/lib/finance/banking/matcher';
import { createBooking } from '@/lib/finance/aktenkonto/booking';

const confirmSchema = z.object({
  transaktionId: z.string().min(1),
  rechnungId: z.string().min(1),
});

// ─── GET /api/finanzen/banking/match ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RBAC: ADMIN, ANWALT, SACHBEARBEITER
  const role = (session.user as any).role;
  if (!['ADMIN', 'ANWALT', 'SACHBEARBEITER'].includes(role)) {
    return NextResponse.json(
      { error: 'Keine Berechtigung' },
      { status: 403 },
    );
  }

  try {
    const results = await matchTransactions();

    return NextResponse.json({
      transaktionen: results,
      total: results.length,
      mitVorschlaegen: results.filter((r) => r.matches.length > 0).length,
    });
  } catch (err: any) {
    console.error('Match listing error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Zuordnungen' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/banking/match ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RBAC: ADMIN, ANWALT, SACHBEARBEITER
  const role = (session.user as any).role;
  if (!['ADMIN', 'ANWALT', 'SACHBEARBEITER'].includes(role)) {
    return NextResponse.json(
      { error: 'Keine Berechtigung' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { transaktionId, rechnungId } = parsed.data;
    const userId = session.user.id;

    // Execute match confirmation as a transaction (cascading effects)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Load transaction
      const transaktion = await tx.bankTransaktion.findUnique({
        where: { id: transaktionId },
      });

      if (!transaktion) {
        throw new Error('Transaktion nicht gefunden');
      }

      if (transaktion.zugeordnet) {
        throw new Error('Transaktion ist bereits zugeordnet');
      }

      // 2. Load invoice
      const rechnung = await tx.rechnung.findUnique({
        where: { id: rechnungId },
      });

      if (!rechnung) {
        throw new Error('Rechnung nicht gefunden');
      }

      const txBetrag = transaktion.betrag.toNumber();
      const rechnungBrutto = rechnung.betragBrutto.toNumber();
      const restBetrag = rechnung.restBetrag?.toNumber() ?? rechnungBrutto;

      // 3. Mark transaction as matched
      const updatedTransaktion = await tx.bankTransaktion.update({
        where: { id: transaktionId },
        data: {
          zugeordnet: true,
          rechnungId,
          akteId: rechnung.akteId,
        },
      });

      // 4. Create Teilzahlung or mark as fully paid
      let teilzahlung = null;
      let invoiceUpdate: Record<string, any> = {};

      if (txBetrag >= restBetrag - 0.01) {
        // Full payment: transition to BEZAHLT
        invoiceUpdate = {
          status: 'BEZAHLT',
          bezahltAm: new Date(),
          restBetrag: 0,
        };
      } else {
        // Partial payment: create Teilzahlung and update restBetrag
        teilzahlung = await tx.teilzahlung.create({
          data: {
            rechnungId,
            betrag: txBetrag,
            zahlungsdatum: transaktion.buchungsdatum,
            verwendungszweck: transaktion.verwendungszweck,
            bankTransaktionId: transaktionId,
          },
        });

        invoiceUpdate = {
          restBetrag: restBetrag - txBetrag,
        };
      }

      const updatedRechnung = await tx.rechnung.update({
        where: { id: rechnungId },
        data: invoiceUpdate,
      });

      // 5. Auto-book EINNAHME in Aktenkonto
      const buchung = await createBooking(tx as any, {
        akteId: rechnung.akteId,
        buchungstyp: BuchungsTyp.EINNAHME,
        betrag: txBetrag,
        verwendungszweck: `Bankeingang: ${transaktion.verwendungszweck}`.substring(0, 200),
        buchungsdatum: transaktion.buchungsdatum,
        rechnungId,
        bankTransaktionId: transaktionId,
        gebuchtVon: userId,
      });

      return {
        transaktion: {
          ...updatedTransaktion,
          betrag: updatedTransaktion.betrag.toNumber(),
          saldo: updatedTransaktion.saldo?.toNumber() ?? null,
        },
        rechnung: {
          id: updatedRechnung.id,
          rechnungsnummer: updatedRechnung.rechnungsnummer,
          status: updatedRechnung.status,
          restBetrag: updatedRechnung.restBetrag?.toNumber() ?? 0,
        },
        buchung: {
          id: buchung.id,
          betrag: buchung.betrag.toNumber(),
          verwendungszweck: buchung.verwendungszweck,
        },
        teilzahlung: teilzahlung
          ? { id: teilzahlung.id, betrag: teilzahlung.betrag.toNumber() }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Match confirmation error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler bei der Zuordnung' },
      { status: err.message?.includes('nicht gefunden') ? 404 : 500 },
    );
  }
}
