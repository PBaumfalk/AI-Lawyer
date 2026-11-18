// RVG Calculation API
// POST: Calculate RVG fees and optionally save to database

import { NextRequest, NextResponse } from 'next/server';
import { akteAccessDenied } from "@/lib/rbac";
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildCalculation } from '@/lib/finance/rvg/calculator';
import { buildInvoiceFromRvg, rvgCalculateSchema, toCalculatorPositions } from '@/lib/finance/rvg/contract';

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

  const parsed = rvgCalculateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (data.akteId) {
    const denied = await akteAccessDenied(session, data.akteId);
    if (denied) return denied;
  }

  try {
    const auftragseingang = data.auftragseingang
      ? new Date(data.auftragseingang)
      : undefined;

    // Build calculation using the RVG calculator
    const positions = toCalculatorPositions(data.positionen);

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

    return NextResponse.json({
      ergebnis: result,
      savedId,
      uebernehmenAlsRechnung: data.akteId
        ? buildInvoiceFromRvg(result, { akteId: data.akteId, rvgBerechnungId: savedId ?? undefined })
        : null,
    });
  } catch (err: any) {
    console.error('RVG calculation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler bei der RVG-Berechnung' },
      { status: 500 },
    );
  }
}
