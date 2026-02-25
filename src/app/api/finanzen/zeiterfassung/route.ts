// Time Entry CRUD API
// GET: List time entries with filters and summary stats
// POST: Create manual time entry
// PATCH: Update entry (only if not abgerechnet)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, requireAkteAccess, buildAkteAccessFilter } from '@/lib/rbac';
import { z } from 'zod';

const querySchema = z.object({
  akteId: z.string().optional(),
  userId: z.string().optional(),
  von: z.string().optional(),
  bis: z.string().optional(),
  kategorie: z.string().optional(),
  abrechenbar: z.enum(['true', 'false']).optional(),
  abgerechnet: z.enum(['true', 'false']).optional(),
  seite: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createSchema = z.object({
  akteId: z.string().min(1, 'Akte ist erforderlich'),
  datum: z.string().transform((s) => new Date(s)),
  dauer: z.number().int().min(1, 'Dauer muss mindestens 1 Minute betragen'),
  beschreibung: z.string().min(1, 'Beschreibung ist erforderlich'),
  stundensatz: z.number().positive().optional(),
  kategorie: z.string().optional(),
  abrechenbar: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  id: z.string().min(1),
  beschreibung: z.string().optional(),
  kategorie: z.string().nullable().optional(),
  abrechenbar: z.boolean().optional(),
  dauer: z.number().int().min(1).optional(),
});

// ─── GET /api/finanzen/zeiterfassung ─────────────────────────────────────────

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

  const { akteId, userId, von, bis, kategorie, abrechenbar, abgerechnet, seite, limit } = parsed.data;

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

    const where: Record<string, any> = {};
    // Apply Akte-level access filter
    if (Object.keys(akteAccessFilter).length > 0) {
      where.akte = akteAccessFilter;
    }
    if (akteId) where.akteId = akteId;
    if (userId) where.userId = userId;
    if (kategorie) where.kategorie = kategorie;
    if (abrechenbar !== undefined) where.abrechenbar = abrechenbar === 'true';
    if (abgerechnet !== undefined) where.abgerechnet = abgerechnet === 'true';
    if (von || bis) {
      where.datum = {};
      if (von) where.datum.gte = new Date(von);
      if (bis) where.datum.lte = new Date(bis);
    }
    // Exclude running timer entries from list (they have dauer=0)
    where.isRunning = false;

    const [eintraege, total] = await Promise.all([
      prisma.zeiterfassung.findMany({
        where,
        include: {
          akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: [{ datum: 'desc' }, { createdAt: 'desc' }],
        skip: (seite - 1) * limit,
        take: limit,
      }),
      prisma.zeiterfassung.count({ where }),
    ]);

    // Calculate summary stats (reuse same access-scoped where)
    const allEntries = await prisma.zeiterfassung.findMany({
      where,
      select: { dauer: true, abrechenbar: true, stundensatz: true },
    });

    let totalMinuten = 0;
    let abrechenbarMinuten = 0;
    let totalBillableAmount = 0;

    for (const e of allEntries) {
      totalMinuten += e.dauer;
      if (e.abrechenbar) {
        abrechenbarMinuten += e.dauer;
        const rate = e.stundensatz?.toNumber() ?? 0;
        totalBillableAmount += (e.dauer / 60) * rate;
      }
    }

    const effektiverStundensatz = abrechenbarMinuten > 0
      ? Math.round((totalBillableAmount / (abrechenbarMinuten / 60)) * 100) / 100
      : 0;

    return NextResponse.json({
      eintraege: eintraege.map((e) => ({
        id: e.id,
        akteId: e.akteId,
        aktenzeichen: e.akte.aktenzeichen,
        kurzrubrum: e.akte.kurzrubrum,
        userId: e.userId,
        userName: e.user.name,
        datum: e.datum,
        dauer: e.dauer,
        beschreibung: e.beschreibung,
        stundensatz: e.stundensatz?.toNumber() ?? null,
        kategorie: e.kategorie,
        abrechenbar: e.abrechenbar,
        abgerechnet: e.abgerechnet,
        createdAt: e.createdAt,
      })),
      summary: {
        totalMinuten,
        abrechenbarMinuten,
        effektiverStundensatz,
      },
      pagination: {
        seite,
        limit,
        total,
        seiten: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('Zeiterfassung list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Zeiterfassung' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/zeiterfassung ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { akteId, datum, dauer, beschreibung, stundensatz, kategorie, abrechenbar } = parsed.data;

    // Verify user has access to the Akte
    const akteAccess = await requireAkteAccess(akteId);
    if (akteAccess.error) return akteAccess.error;

    // Get default Stundensatz if not provided
    let resolvedStundensatz = stundensatz;
    if (resolvedStundensatz === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { kanzleiId: true },
      });

      if (user?.kanzleiId) {
        const kanzlei = await prisma.kanzlei.findUnique({
          where: { id: user.kanzleiId },
          select: { defaultStundensatz: true },
        });
        resolvedStundensatz = kanzlei?.defaultStundensatz?.toNumber() ?? undefined;
      }
    }

    const entry = await prisma.zeiterfassung.create({
      data: {
        akteId,
        userId: session.user.id,
        datum,
        dauer,
        beschreibung,
        stundensatz: resolvedStundensatz ?? null,
        kategorie: kategorie ?? null,
        abrechenbar,
        isRunning: false,
      },
    });

    return NextResponse.json(
      {
        id: entry.id,
        akteId: entry.akteId,
        datum: entry.datum,
        dauer: entry.dauer,
        beschreibung: entry.beschreibung,
        stundensatz: entry.stundensatz?.toNumber() ?? null,
        kategorie: entry.kategorie,
        abrechenbar: entry.abrechenbar,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Zeiterfassung create error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Zeiteintrags' },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/finanzen/zeiterfassung ───────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id, ...updates } = parsed.data;

    // Check if entry exists and is not abgerechnet
    const existing = await prisma.zeiterfassung.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Zeiteintrag nicht gefunden' },
        { status: 404 },
      );
    }

    // Verify user has access to the entry's Akte
    const akteAccess = await requireAkteAccess(existing.akteId);
    if (akteAccess.error) return akteAccess.error;

    if (existing.abgerechnet) {
      return NextResponse.json(
        { error: 'Bereits abgerechnete Eintraege koennen nicht bearbeitet werden' },
        { status: 400 },
      );
    }

    const entry = await prisma.zeiterfassung.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      id: entry.id,
      dauer: entry.dauer,
      beschreibung: entry.beschreibung,
      kategorie: entry.kategorie,
      abrechenbar: entry.abrechenbar,
    });
  } catch (err: any) {
    console.error('Zeiterfassung update error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Zeiteintrags' },
      { status: 500 },
    );
  }
}
