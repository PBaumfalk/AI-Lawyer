// RVG Calculations per Akte API
// GET: List saved RVG calculations for an Akte
// POST: Save a new RVG calculation for an Akte with one-click invoice transfer

import { NextRequest, NextResponse } from 'next/server';
import { akteAccessDenied } from "@/lib/rbac";
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildCalculation } from '@/lib/finance/rvg/calculator';
import { logAuditEvent } from '@/lib/audit';
import {
  buildInvoiceFromRvg,
  rvgSaveSchema,
  toCalculatorPositions,
  type RvgSaveResponse,
} from '@/lib/finance/rvg/contract';

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
  const denied = await akteAccessDenied(session, akteId);
  if (denied) return denied;

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
      return {
        ...b,
        uebernehmenAlsRechnung: buildInvoiceFromRvg(
          { items: Array.isArray(ergebnis?.items) ? ergebnis.items : [] },
          { akteId, rvgBerechnungId: b.id },
        ),
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
  const denied = await akteAccessDenied(session, akteId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const parsed = rvgSaveSchema.safeParse(body);
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
    const positions = toCalculatorPositions(data.positionen);

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

    return NextResponse.json<RvgSaveResponse>(
      {
        berechnung: {
          ...berechnung,
          uebernehmenAlsRechnung: buildInvoiceFromRvg(result, { akteId, rvgBerechnungId: berechnung.id }),
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
