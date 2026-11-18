// Per-Case Aktenkonto API
// GET: Bookings with running balance, saldo, and Fremdgeld alerts
// POST: Create manual booking with RBAC

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAkteAccess } from '@/lib/rbac';
import { z } from 'zod';
import { BuchungsTyp } from '@prisma/client';
import { createBooking } from '@/lib/finance/aktenkonto/booking';
import { checkFremdgeldCompliance } from '@/lib/finance/aktenkonto/fremdgeld';
import { calculateSaldo, calculateRunningBalance } from '@/lib/finance/aktenkonto/saldo';
import { bookingSchema, type AktenkontoBuchungDto } from '@/lib/finance/aktenkonto/contract';

const querySchema = z.object({
  buchungstyp: z.nativeEnum(BuchungsTyp).optional(),
  von: z.string().optional(),
  bis: z.string().optional(),
});

// ─── GET /api/finanzen/aktenkonto/[akteId] ──────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ akteId: string }> },
) {
  const { akteId } = await params;

  // Verify user has access to this Akte (returns 404 if not)
  const akteAccess = await requireAkteAccess(akteId);
  if (akteAccess.error) return akteAccess.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // Akte existence already verified by requireAkteAccess
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { id: true, aktenzeichen: true, kurzrubrum: true },
    });

    if (!akte) {
      return NextResponse.json({ error: 'Akte nicht gefunden' }, { status: 404 });
    }

    // Get bookings with running balance
    const alleBuchungen = await calculateRunningBalance(akteId);
    const storniertDurch = new Map(
      alleBuchungen.filter((b) => b.stornoVon).map((b) => [b.stornoVon as string, b.id]),
    );
    const buchungenMitSaldo = alleBuchungen.map(
      (b): Omit<AktenkontoBuchungDto, 'buchungsdatum'> & { buchungsdatum: Date } => ({
        id: b.id,
        buchungstyp: b.buchungstyp,
        betrag: b.betrag,
        verwendungszweck: b.verwendungszweck,
        buchungsdatum: b.buchungsdatum,
        kostenstelle: b.kostenstelle,
        konto: b.konto,
        dokumentId: b.dokumentId,
        rechnungId: b.rechnungId,
        fremdgeldFrist: b.fremdgeldFrist ? b.fremdgeldFrist.toISOString() : null,
        stornoVon: b.stornoVon,
        stornoGrund: b.stornoGrund,
        storniertDurch: storniertDurch.get(b.id) ?? null,
        laufenderSaldo: b.laufenderSaldo,
      }),
    );

    // Apply filters if provided
    let filtered = buchungenMitSaldo;
    if (parsed.data.buchungstyp) {
      filtered = filtered.filter((b) => b.buchungstyp === parsed.data.buchungstyp);
    }
    if (parsed.data.von) {
      const vonDate = new Date(parsed.data.von);
      filtered = filtered.filter((b) => b.buchungsdatum >= vonDate);
    }
    if (parsed.data.bis) {
      const bisDate = new Date(parsed.data.bis);
      filtered = filtered.filter((b) => b.buchungsdatum <= bisDate);
    }

    // Get balance and compliance data
    const [saldo, compliance] = await Promise.all([
      calculateSaldo(akteId),
      checkFremdgeldCompliance(akteId),
    ]);

    return NextResponse.json({
      akte: {
        id: akte.id,
        aktenzeichen: akte.aktenzeichen,
        kurzrubrum: akte.kurzrubrum,
      },
      buchungen: filtered,
      saldo,
      fremdgeldAlerts: compliance.alerts,
      anderkontoAlert: compliance.anderkontoAlert ?? null,
    });
  } catch (err: any) {
    console.error('Aktenkonto detail error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Aktenkontos' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/aktenkonto/[akteId] ─────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ akteId: string }> },
) {
  const { akteId } = await params;

  // Verify user has access to this Akte (returns 404 if not)
  const akteAccess = await requireAkteAccess(akteId);
  if (akteAccess.error) return akteAccess.error;
  const { session } = akteAccess;

  const userId = session.user.id;
  const userRole = session.user.role;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // RBAC: SEKRETARIAT cannot book FREMDGELD
  if (userRole === 'SEKRETARIAT' && data.buchungstyp === BuchungsTyp.FREMDGELD) {
    return NextResponse.json(
      { error: 'Keine Berechtigung. Sekretariat darf keine Fremdgeld-Buchungen erstellen.' },
      { status: 403 },
    );
  }

  try {
    // Create booking within a transaction
    const buchung = await prisma.$transaction(async (tx) => {
      return createBooking(tx, {
        akteId,
        buchungstyp: data.buchungstyp,
        betrag: data.betrag,
        verwendungszweck: data.verwendungszweck,
        buchungsdatum: data.buchungsdatum ? new Date(data.buchungsdatum) : undefined,
        kostenstelle: data.kostenstelle,
        konto: data.konto,
        dokumentId: data.dokumentId,
        gebuchtVon: userId,
        richtung: data.richtung,
      });
    });

    // Return new booking + updated saldo
    const saldo = await calculateSaldo(akteId);

    return NextResponse.json(
      {
        buchung: {
          ...buchung,
          betrag: buchung.betrag.toNumber(),
        },
        saldo,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Aktenkonto booking error:', err);

    // Handle period lock errors with clear message
    if (err.message?.includes('gesperrt') || err.message?.includes('uebersteigt')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Erstellen der Buchung' },
      { status: 500 },
    );
  }
}
