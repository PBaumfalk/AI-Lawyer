// Invoice List + Create API
// GET: List invoices with filters, pagination, and summary stats
// POST: Create invoice with atomic Rechnungsnummer and SS 14 UStG validation

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireAkteAccess, buildAkteAccessFilter } from '@/lib/rbac';
import { getNextInvoiceNumber } from '@/lib/finance/invoice/nummernkreis';
import { enqueueQuestCheck } from '@/lib/gamification/quest-service';
import type { Prisma } from '@prisma/client';
import type { InvoicePosition, UstSummary } from '@/lib/finance/invoice/types';
import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  type CreateInvoiceResponse,
  type InvoiceListResponse,
} from '@/lib/finance/invoice/contract';
import { toInvoiceListItem } from '@/lib/finance/invoice/serialize';

// ─── GET /api/finanzen/rechnungen ────────────────────────────────────────────
// Query and response follow InvoiceListQuery / InvoiceListResponse in
// src/lib/finance/invoice/contract.ts (shared with invoice-list.tsx).

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const parsedQuery = invoiceListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Ungültige Abfrageparameter', details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }
  const q = parsedQuery.data;

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

    // Scope: access + Akte/Mandant/date range. KPI stats are computed on the
    // scope only, so they do not jump when the user filters the table.
    const scope: Prisma.RechnungWhereInput = {};
    if (q.mandantId) {
      scope.akte = {
        ...akteAccessFilter,
        beteiligte: { some: { kontaktId: q.mandantId, rolle: 'MANDANT' } },
      };
    } else if (Object.keys(akteAccessFilter).length > 0) {
      scope.akte = akteAccessFilter;
    }
    if (q.akteId) scope.akteId = q.akteId;
    if (q.dateFrom || q.dateTo) {
      scope.rechnungsdatum = {
        ...(q.dateFrom && { gte: new Date(q.dateFrom) }),
        ...(q.dateTo && { lte: new Date(q.dateTo) }),
      };
    }

    // Table filters on top of the scope
    const where: Prisma.RechnungWhereInput = { ...scope };
    if (q.status) where.status = q.status;
    if (q.ueberfaellig === 'true') {
      where.faelligAm = { lt: new Date() };
      where.status = { in: ['GESTELLT', 'MAHNUNG'] };
    }
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [
        { rechnungsnummer: contains },
        { akte: { aktenzeichen: contains } },
        { akte: { kurzrubrum: contains } },
        {
          akte: {
            beteiligte: {
              some: {
                rolle: 'MANDANT',
                kontakt: { OR: [{ nachname: contains }, { vorname: contains }, { firma: contains }] },
              },
            },
          },
        },
      ];
    }

    const offen: Prisma.RechnungWhereInput = { ...scope, status: { in: ['GESTELLT', 'MAHNUNG'] } };
    // Stornobelege (GS numbers, stornoVon set) are not invoices of their own
    const ausgestellt: Prisma.RechnungWhereInput = {
      ...scope,
      stornoVon: null,
      status: { in: ['GESTELLT', 'MAHNUNG', 'BEZAHLT', 'STORNIERT'] },
    };

    const [rechnungen, total, offenAgg, ueberfaelligCount, umsatzAgg, ausgestelltCount, storniertCount] =
      await Promise.all([
        prisma.rechnung.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: [{ [q.sortBy]: q.sortDir }, { id: 'asc' }],
          include: {
            akte: {
              select: {
                aktenzeichen: true,
                kurzrubrum: true,
                beteiligte: {
                  where: { rolle: 'MANDANT' },
                  select: { kontakt: { select: { vorname: true, nachname: true, firma: true } } },
                  take: 1,
                },
              },
            },
          },
        }),
        prisma.rechnung.count({ where }),
        prisma.rechnung.aggregate({ _sum: { restBetrag: true }, where: offen }),
        prisma.rechnung.count({ where: { ...offen, faelligAm: { lt: new Date() } } }),
        prisma.rechnung.aggregate({ _sum: { betragNetto: true }, where: { ...scope, status: 'BEZAHLT' } }),
        prisma.rechnung.count({ where: ausgestellt }),
        prisma.rechnung.count({ where: { ...ausgestellt, status: 'STORNIERT' } }),
      ]);

    return NextResponse.json<InvoiceListResponse>({
      rechnungen: rechnungen.map((r) => toInvoiceListItem(r)),
      total,
      page: q.page,
      limit: q.limit,
      stats: {
        offeneForderungen: offenAgg._sum.restBetrag?.toNumber() ?? 0,
        ueberfaellig: ueberfaelligCount,
        gesamtUmsatz: umsatzAgg._sum.betragNetto?.toNumber() ?? 0,
        stornoquote:
          ausgestelltCount === 0
            ? 0
            : Math.round((storniertCount / ausgestelltCount) * 1000) / 10,
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
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
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

    // Gamification: enqueue quest check after Rechnung creation
    if (userId) {
      enqueueQuestCheck(userId);
    }

    return NextResponse.json<CreateInvoiceResponse>(
      { rechnung: { id: rechnung.id, rechnungsnummer: rechnung.rechnungsnummer } },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Invoice creation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Erstellen der Rechnung' },
      { status: 500 },
    );
  }
}
