// Cross-Case Aktenkonto API
// GET: List all bookings across cases with filters, pagination, and summary stats

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, buildAkteAccessFilter } from '@/lib/rbac';
import { z } from 'zod';
import { BuchungsTyp, KontoTyp } from '@prisma/client';

const querySchema = z.object({
  akteId: z.string().optional(),
  buchungstyp: z.nativeEnum(BuchungsTyp).optional(),
  konto: z.nativeEnum(KontoTyp).optional(),
  kostenstelle: z.string().optional(),
  von: z.string().optional(), // ISO date
  bis: z.string().optional(), // ISO date
  seite: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── GET /api/finanzen/aktenkonto ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { akteId, buchungstyp, konto, kostenstelle, von, bis, seite, limit } = parsed.data;

  try {
    // Determine access scope
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canSeeKanzleiFinanzen: true },
    });
    const showKanzleiweit =
      session.user.role === 'ADMIN' ||
      (session.user.role === 'ANWALT' && user?.canSeeKanzleiFinanzen);
    const akteAccessFilter = showKanzleiweit
      ? {}
      : buildAkteAccessFilter(session.user.id, session.user.role);

    // Build where clause with RBAC access filter
    const where: Record<string, any> = {};
    if (Object.keys(akteAccessFilter).length > 0) {
      where.akte = akteAccessFilter;
    }
    if (akteId) where.akteId = akteId;
    if (buchungstyp) where.buchungstyp = buchungstyp;
    if (konto) where.konto = konto;
    if (kostenstelle) where.kostenstelle = kostenstelle;
    if (von || bis) {
      where.buchungsdatum = {};
      if (von) where.buchungsdatum.gte = new Date(von);
      if (bis) where.buchungsdatum.lte = new Date(bis);
    }

    const [buchungen, total] = await Promise.all([
      prisma.aktenKontoBuchung.findMany({
        where,
        include: {
          akte: {
            select: { id: true, aktenzeichen: true, kurzrubrum: true },
          },
        },
        orderBy: [{ buchungsdatum: 'desc' }, { createdAt: 'desc' }],
        skip: (seite - 1) * limit,
        take: limit,
      }),
      prisma.aktenKontoBuchung.count({ where }),
    ]);

    // Summary stats across all matching bookings
    const allBuchungen = await prisma.aktenKontoBuchung.findMany({
      where,
      select: { buchungstyp: true, betrag: true },
    });

    let einnahmen = 0;
    let ausgaben = 0;
    let fremdgeld = 0;
    let auslagen = 0;

    for (const b of allBuchungen) {
      const betrag = b.betrag.toNumber();
      switch (b.buchungstyp) {
        case BuchungsTyp.EINNAHME:
          einnahmen += betrag;
          break;
        case BuchungsTyp.AUSGABE:
          ausgaben += betrag;
          break;
        case BuchungsTyp.FREMDGELD:
          fremdgeld += betrag;
          break;
        case BuchungsTyp.AUSLAGE:
          auslagen += betrag;
          break;
      }
    }

    // Fremdgeld alerts: find Akten where Fremdgeld balance is critical
    const fremdgeldAlerts: Array<{ akteId: string; aktenzeichen: string; fremdgeldSaldo: number; warnung: string }> = [];
    if (fremdgeld !== 0) {
      // Group Fremdgeld bookings by Akte to identify per-case alerts
      const fremdgeldByAkte = new Map<string, { sum: number; aktenzeichen: string }>();
      const fremdgeldBuchungen = await prisma.aktenKontoBuchung.findMany({
        where: { ...where, buchungstyp: BuchungsTyp.FREMDGELD },
        select: { akteId: true, betrag: true, akte: { select: { aktenzeichen: true } } },
      });
      for (const fb of fremdgeldBuchungen) {
        const existing = fremdgeldByAkte.get(fb.akteId) ?? { sum: 0, aktenzeichen: fb.akte.aktenzeichen };
        existing.sum += fb.betrag.toNumber();
        fremdgeldByAkte.set(fb.akteId, existing);
      }
      for (const [aId, data] of Array.from(fremdgeldByAkte.entries())) {
        const saldo = Math.round(data.sum * 100) / 100;
        if (saldo < 0) {
          fremdgeldAlerts.push({
            akteId: aId,
            aktenzeichen: data.aktenzeichen,
            fremdgeldSaldo: saldo,
            warnung: 'Negatives Fremdgeld-Saldo',
          });
        }
      }
    }

    return NextResponse.json({
      buchungen: buchungen.map((b) => ({
        ...b,
        betrag: b.betrag.toNumber(),
        aktenzeichen: b.akte.aktenzeichen,
        kurzrubrum: b.akte.kurzrubrum,
      })),
      summary: {
        einnahmen: Math.round(einnahmen * 100) / 100,
        ausgaben: Math.round(Math.abs(ausgaben) * 100) / 100,
        fremdgeld: Math.round(fremdgeld * 100) / 100,
        auslagen: Math.round(Math.abs(auslagen) * 100) / 100,
      },
      fremdgeldAlerts,
      pagination: {
        seite,
        limit,
        total,
        seiten: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('Aktenkonto list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Buchungen' },
      { status: 500 },
    );
  }
}
