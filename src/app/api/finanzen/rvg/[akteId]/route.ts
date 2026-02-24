// RVG Calculations per Akte API
// GET: List saved RVG calculations for an Akte
// POST: Save a new RVG calculation for an Akte with one-click invoice transfer

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildCalculation } from '@/lib/finance/rvg/calculator';
import { logAuditEvent } from '@/lib/audit';
import { z } from 'zod';

// ─── Validation Schema ───────────────────────────────────────────────────────

const rvgPositionSchema = z.object({
  vvNr: z.string().min(1),
  rate: z.number().optional(),
  gegenstandswert: z.number().optional(),
  anzahlAuftraggeber: z.number().optional(),
  betrag: z.number().optional(),
  km: z.number().optional(),
  tage: z.number().optional(),
});

const saveCalculationSchema = z.object({
  streitwert: z.number().positive('Streitwert muss positiv sein'),
  auftragseingang: z.string().datetime().optional(),
  positionen: z.array(rvgPositionSchema).min(1, 'Mindestens eine VV-Position erforderlich'),
  autoAnrechnung: z.boolean().optional().default(true),
  autoAuslagen: z.boolean().optional().default(true),
  autoUst: z.boolean().optional().default(true),
});

// ─── GET /api/finanzen/rvg/[akteId] ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ akteId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { akteId } = await params;

  try {
    // Verify Akte exists
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { id: true, aktenzeichen: true, gegenstandswert: true },
    });

    if (!akte) {
      return NextResponse.json({ error: 'Akte nicht gefunden' }, { status: 404 });
    }

    const berechnungen = await prisma.rvgBerechnung.findMany({
      where: { akteId },
      orderBy: { createdAt: 'desc' },
    });

    // Add uebernehmenAlsRechnung helper for each saved calculation
    const formatted = berechnungen.map((b) => {
      const ergebnis = b.ergebnis as any;
      const items = ergebnis?.items ?? [];

      const invoicePositionen = items.map((item: any) => ({
        vvNr: item.vvNr,
        beschreibung: item.name + (item.notes ? ` (${item.notes})` : ''),
        menge: 1,
        einzelpreis: item.finalAmount,
        ustSatz: item.vvNr === '7008' ? 0 : 19,
        betrag: item.finalAmount,
      }));

      return {
        ...b,
        uebernehmenAlsRechnung: {
          positionen: invoicePositionen,
          betragNetto: ergebnis?.nettoGesamt ?? 0,
          betragBrutto: ergebnis?.bruttoGesamt ?? 0,
          typ: 'RVG',
          rvgBerechnungId: b.id,
          akteId,
        },
      };
    });

    return NextResponse.json({
      berechnungen: formatted,
      aktenzeichen: akte.aktenzeichen,
      gegenstandswert: akte.gegenstandswert?.toNumber() ?? null,
    });
  } catch (err: any) {
    console.error('RVG list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der RVG-Berechnungen' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/rvg/[akteId] ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ akteId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { akteId } = await params;
  const userId = session.user.id!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = saveCalculationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    // Verify Akte exists
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { id: true, aktenzeichen: true },
    });

    if (!akte) {
      return NextResponse.json({ error: 'Akte nicht gefunden' }, { status: 404 });
    }

    const auftragseingang = data.auftragseingang
      ? new Date(data.auftragseingang)
      : undefined;

    // Calculate using the RVG calculator
    const positions = data.positionen.map((p) => ({
      nr: p.vvNr,
      options: {
        rate: p.rate,
        gegenstandswert: p.gegenstandswert,
        anzahlAuftraggeber: p.anzahlAuftraggeber,
        betrag: p.betrag,
        km: p.km,
        tage: p.tage,
      },
    }));

    const result = buildCalculation(data.streitwert, positions, {
      auftragseingang,
      disableAnrechnung: !data.autoAnrechnung,
      disableAutoAuslagen: !data.autoAuslagen,
      disableAutoUst: !data.autoUst,
    });

    // Save to database
    const berechnung = await prisma.rvgBerechnung.create({
      data: {
        akteId,
        userId,
        streitwert: data.streitwert,
        positionen: data.positionen as any,
        ergebnis: result as any,
        auftragseingang: auftragseingang ?? null,
        tabelleVersion: result.feeTableVersion,
      },
    });

    // Audit log
    await logAuditEvent({
      userId,
      akteId,
      aktion: 'RVG_BERECHNUNG_GESPEICHERT',
      details: {
        berechnungId: berechnung.id,
        streitwert: data.streitwert,
        bruttoGesamt: result.bruttoGesamt,
        positionenAnzahl: result.items.length,
      },
    });

    // Build pre-filled invoice data for one-click transfer
    const invoicePositionen = result.items.map((item) => ({
      vvNr: item.vvNr,
      beschreibung: item.name + (item.notes ? ` (${item.notes})` : ''),
      menge: 1,
      einzelpreis: item.finalAmount,
      ustSatz: item.vvNr === '7008' ? 0 : 19,
      betrag: item.finalAmount,
    }));

    return NextResponse.json(
      {
        berechnung: {
          ...berechnung,
          uebernehmenAlsRechnung: {
            positionen: invoicePositionen,
            betragNetto: result.nettoGesamt,
            betragBrutto: result.bruttoGesamt,
            typ: 'RVG',
            rvgBerechnungId: berechnung.id,
            akteId,
          },
        },
        ergebnis: result,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('RVG save error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Speichern der RVG-Berechnung' },
      { status: 500 },
    );
  }
}
