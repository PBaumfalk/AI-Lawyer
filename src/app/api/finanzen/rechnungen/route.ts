// Invoice List + Create API
// GET: List invoices with filters, pagination, and summary stats
// POST: Create invoice with atomic Rechnungsnummer and SS 14 UStG validation

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireAkteAccess, buildAkteAccessFilter } from '@/lib/rbac';
import { getNextInvoiceNumber } from '@/lib/finance/invoice/nummernkreis';
import { z } from 'zod';
import type { InvoicePosition, UstSummary } from '@/lib/finance/invoice/types';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const positionSchema = z.object({
  vvNr: z.string().optional(),
  beschreibung: z.string().min(1, 'Beschreibung ist erforderlich'),
  menge: z.number().positive('Menge muss positiv sein'),
  einzelpreis: z.number().min(0, 'Einzelpreis darf nicht negativ sein'),
  ustSatz: z.number().min(0).max(100),
  betrag: z.number(),
});

const createInvoiceSchema = z.object({
  akteId: z.string().min(1, 'Akten-ID ist erforderlich'),
  empfaengerId: z.string().optional(),
  positionen: z.array(positionSchema).min(1, 'Mindestens eine Position erforderlich'),
  zahlungszielTage: z.number().int().positive().optional(),
  notizen: z.string().optional(),
  isPkh: z.boolean().optional(),
  rvgBerechnungId: z.string().optional(),
  typ: z.enum(['RVG', 'STUNDENHONORAR', 'PAUSCHALE']).optional(),
});

// ─── GET /api/finanzen/rechnungen ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const akteId = searchParams.get('akteId');
  const mandantId = searchParams.get('mandantId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const ueberfaellig = searchParams.get('ueberfaellig');
  const skip = parseInt(searchParams.get('skip') ?? '0', 10);
  const take = parseInt(searchParams.get('take') ?? '50', 10);

  try {
    // Determine access scope: ADMIN always kanzleiweit, ANWALT if canSeeKanzleiFinanzen
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

    // Build filter conditions with RBAC access filter
    const where: Record<string, any> = {};

    // Apply Akte-level access filter (merge with mandant filter if present)
    if (mandantId) {
      where.akte = {
        ...akteAccessFilter,
        beteiligte: {
          some: { kontaktId: mandantId, rolle: 'MANDANT' },
        },
      };
    } else if (Object.keys(akteAccessFilter).length > 0) {
      where.akte = akteAccessFilter;
    }

    if (status) {
      where.status = status;
    }
    if (akteId) {
      where.akteId = akteId;
    }
    if (dateFrom || dateTo) {
      where.rechnungsdatum = {};
      if (dateFrom) where.rechnungsdatum.gte = new Date(dateFrom);
      if (dateTo) where.rechnungsdatum.lte = new Date(dateTo);
    }
    if (ueberfaellig === 'true') {
      where.faelligAm = { lt: new Date() };
      where.status = { in: ['GESTELLT', 'MAHNUNG'] };
    }

    const [rechnungen, total] = await Promise.all([
      prisma.rechnung.findMany({
        where,
        skip,
        take,
        orderBy: { rechnungsdatum: 'desc' },
        include: {
          akte: {
            select: {
              aktenzeichen: true,
              kurzrubrum: true,
              beteiligte: {
                where: { rolle: 'MANDANT' },
                select: {
                  kontakt: {
                    select: { vorname: true, nachname: true, firma: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.rechnung.count({ where }),
    ]);

    // Summary stats -- reuse same access-scoped where for aggregates
    const statsWhere: Record<string, any> = {
      ...where,
      status: { in: ['GESTELLT', 'MAHNUNG'] },
    };

    const [stats, ueberfaelligCount, gesamtUmsatzAgg] = await Promise.all([
      prisma.rechnung.aggregate({
        _sum: { betragNetto: true },
        where: statsWhere,
      }),
      prisma.rechnung.count({
        where: {
          ...where,
          faelligAm: { lt: new Date() },
          status: { in: ['GESTELLT', 'MAHNUNG'] },
        },
      }),
      // gesamtUmsatz: sum of BEZAHLT invoices
      prisma.rechnung.aggregate({
        _sum: { betragNetto: true },
        where: { ...where, status: 'BEZAHLT' },
      }),
    ]);

    // Format Mandant name from Akte beteiligte
    const formatted = rechnungen.map((r) => {
      const mandant = r.akte.beteiligte[0]?.kontakt;
      const mandantName = mandant
        ? mandant.firma ?? [mandant.vorname, mandant.nachname].filter(Boolean).join(' ')
        : null;

      return {
        ...r,
        aktenzeichen: r.akte.aktenzeichen,
        kurzrubrum: r.akte.kurzrubrum,
        mandantName,
      };
    });

    return NextResponse.json({
      rechnungen: formatted,
      total,
      skip,
      take,
      // Provide both 'stats' and 'summary' keys for frontend compatibility
      stats: {
        offeneForderungen: stats._sum.betragNetto?.toNumber() ?? 0,
        ueberfaellig: ueberfaelligCount,
        gesamtUmsatz: gesamtUmsatzAgg._sum.betragNetto?.toNumber() ?? 0,
      },
      summary: {
        offeneForderungen: stats._sum.betragNetto?.toNumber() ?? 0,
        ueberfaelligCount,
      },
    });
  } catch (err: any) {
    console.error('Invoice list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Rechnungen' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/rechnungen ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    // Verify user has access to the referenced Akte
    const akteAccess = await requireAkteAccess(data.akteId);
    if (akteAccess.error) return akteAccess.error;

    // Verify Akte exists and has Mandant
    const akte = await prisma.akte.findUnique({
      where: { id: data.akteId },
      include: {
        beteiligte: {
          where: { rolle: 'MANDANT' },
          select: { kontaktId: true },
          take: 1,
        },
        kanzlei: {
          select: {
            nummernkreisPattern: true,
            defaultZahlungszielTage: true,
          },
        },
      },
    });

    if (!akte) {
      return NextResponse.json({ error: 'Akte nicht gefunden' }, { status: 404 });
    }

    if (akte.beteiligte.length === 0) {
      return NextResponse.json(
        { error: 'Akte hat keinen Mandanten zugeordnet' },
        { status: 400 },
      );
    }

    // Calculate totals from positionen
    const positionen: InvoicePosition[] = data.positionen.map((p) => ({
      ...p,
      betrag: Math.round(p.menge * p.einzelpreis * 100) / 100,
    }));

    const betragNetto = positionen.reduce((sum, p) => sum + p.betrag, 0);

    // Calculate per-rate USt summary
    const ustByRate = new Map<number, number>();
    for (const pos of positionen) {
      const existing = ustByRate.get(pos.ustSatz) ?? 0;
      ustByRate.set(pos.ustSatz, existing + pos.betrag);
    }

    const ustSummary: UstSummary[] = Array.from(ustByRate.entries()).map(
      ([satz, bemessungsgrundlage]) => ({
        satz,
        bemessungsgrundlage: Math.round(bemessungsgrundlage * 100) / 100,
        betrag: Math.round(bemessungsgrundlage * (satz / 100) * 100) / 100,
      }),
    );

    const ustTotal = ustSummary.reduce((sum, u) => sum + u.betrag, 0);
    const betragBrutto = Math.round((betragNetto + ustTotal) * 100) / 100;

    const zahlungszielTage =
      data.zahlungszielTage ?? akte.kanzlei?.defaultZahlungszielTage ?? 14;

    // Create invoice in a transaction with atomic Rechnungsnummer
    const rechnung = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const pattern = akte.kanzlei?.nummernkreisPattern ?? undefined;
      const rechnungsnummer = await getNextInvoiceNumber(
        tx,
        'RE',
        year,
        pattern,
      );

      const created = await tx.rechnung.create({
        data: {
          akteId: data.akteId,
          rechnungsnummer,
          typ: (data.typ as any) ?? 'RVG',
          status: 'ENTWURF',
          betragNetto,
          betragBrutto,
          positionen: positionen as any,
          ustSummary: ustSummary as any,
          zahlungszielTage,
          empfaengerId: data.empfaengerId ?? null,
          notizen: data.notizen ?? null,
          isPkh: data.isPkh ?? false,
          rvgBerechnungId: data.rvgBerechnungId ?? null,
          restBetrag: betragBrutto,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          akteId: data.akteId,
          aktion: 'RECHNUNG_ERSTELLT',
          details: {
            rechnungId: created.id,
            rechnungsnummer,
            betragBrutto,
            typ: data.typ ?? 'RVG',
          },
        },
      });

      return created;
    });

    return NextResponse.json({ rechnung }, { status: 201 });
  } catch (err: any) {
    console.error('Invoice creation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Erstellen der Rechnung' },
      { status: 500 },
    );
  }
}
