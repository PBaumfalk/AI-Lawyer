// RVG Calculation API
// POST: Calculate RVG fees and optionally save to database

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { RvgCalculator, buildCalculation } from '@/lib/finance/rvg/calculator';
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

const calculateSchema = z.object({
  streitwert: z.number().positive('Streitwert muss positiv sein'),
  auftragseingang: z.string().datetime().optional(),
  positionen: z.array(rvgPositionSchema).min(1, 'Mindestens eine VV-Position erforderlich'),
  autoAnrechnung: z.boolean().optional().default(true),
  autoAuslagen: z.boolean().optional().default(true),
  autoUst: z.boolean().optional().default(true),
  akteId: z.string().optional(),
  speichern: z.boolean().optional().default(false),
});

// ─── POST /api/finanzen/rvg ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const userId = session.user.id!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = calculateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const auftragseingang = data.auftragseingang
      ? new Date(data.auftragseingang)
      : undefined;

    // Build calculation using the RVG calculator
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

    // Optionally save to database
    let savedId: string | null = null;

    if (data.speichern && data.akteId) {
      const berechnung = await prisma.rvgBerechnung.create({
        data: {
          akteId: data.akteId,
          userId,
          streitwert: data.streitwert,
          positionen: data.positionen as any,
          ergebnis: result as any,
          auftragseingang: auftragseingang ?? null,
          tabelleVersion: result.feeTableVersion,
        },
      });

      savedId = berechnung.id;
    }

    // Build pre-filled invoice data for one-click transfer
    const invoicePositionen = result.items.map((item) => ({
      vvNr: item.vvNr,
      beschreibung: item.name + (item.notes ? ` (${item.notes})` : ''),
      menge: 1,
      einzelpreis: item.finalAmount,
      ustSatz: item.vvNr === '7008' ? 0 : 19, // USt item itself is not re-taxed
      betrag: item.finalAmount,
    }));

    return NextResponse.json({
      ergebnis: result,
      savedId,
      uebernehmenAlsRechnung: {
        positionen: invoicePositionen,
        betragNetto: result.nettoGesamt,
        betragBrutto: result.bruttoGesamt,
        typ: 'RVG',
        rvgBerechnungId: savedId,
        akteId: data.akteId,
      },
    });
  } catch (err: any) {
    console.error('RVG calculation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler bei der RVG-Berechnung' },
      { status: 500 },
    );
  }
}
