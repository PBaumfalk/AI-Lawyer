// Buchungsperioden (Accounting Periods) API
// GET: List all periods with booking counts
// POST: Lock a period (ADMIN only)
// PATCH: Unlock a period (ADMIN only)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/rbac';
import { z } from 'zod';

const lockSchema = z.object({
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
});

const unlockSchema = z.object({
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12),
  action: z.literal('entsperren'),
});

// ─── GET /api/finanzen/buchungsperioden ──────────────────────────────────────

export async function GET(_request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json({ error: 'Keine Kanzlei zugeordnet' }, { status: 400 });
  }

  try {
    const perioden = await prisma.buchungsperiode.findMany({
      where: { kanzleiId },
      orderBy: [{ jahr: 'desc' }, { monat: 'desc' }],
    });

    // Get booking counts per period
    const periodenMitCounts = await Promise.all(
      perioden.map(async (p) => {
        const buchungenCount = await prisma.aktenKontoBuchung.count({
          where: { periodeId: p.id },
        });

        return {
          ...p,
          buchungenCount,
        };
      }),
    );

    // Generate missing periods for current year if needed
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const existingPeriods = new Set(
      perioden.map((p) => `${p.jahr}-${p.monat}`),
    );

    const missingPeriods: Array<{ jahr: number; monat: number; status: string }> = [];
    for (let m = 1; m <= currentMonth; m++) {
      if (!existingPeriods.has(`${currentYear}-${m}`)) {
        missingPeriods.push({
          jahr: currentYear,
          monat: m,
          status: 'OFFEN',
        });
      }
    }

    return NextResponse.json({
      perioden: periodenMitCounts,
      missingPeriods,
    });
  } catch (err: any) {
    console.error('Buchungsperioden list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Buchungsperioden' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/buchungsperioden ─────────────────────────────────────
// Lock a period (set status = GESPERRT)

export async function POST(request: NextRequest) {
  const roleResult = await requireRole('ADMIN');
  if (roleResult.error) return roleResult.error;
  const { session } = roleResult;

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json({ error: 'Keine Kanzlei zugeordnet' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { jahr, monat } = parsed.data;
  const userId = session.user.id;

  try {
    // Enforce sequential closing: earlier periods must be GESPERRT
    const earlierOpenPeriods = await prisma.buchungsperiode.findMany({
      where: {
        kanzleiId,
        status: 'OFFEN',
        OR: [
          { jahr: { lt: jahr } },
          { jahr, monat: { lt: monat } },
        ],
      },
    });

    if (earlierOpenPeriods.length > 0) {
      const earliest = earlierOpenPeriods[0];
      return NextResponse.json(
        {
          error: `Fruehere Perioden muessen zuerst gesperrt werden: ${earliest.monat.toString().padStart(2, '0')}/${earliest.jahr}`,
        },
        { status: 400 },
      );
    }

    // Upsert the period (create if not exists, update if exists)
    const periode = await prisma.buchungsperiode.upsert({
      where: {
        kanzleiId_jahr_monat: { kanzleiId, jahr, monat },
      },
      create: {
        kanzleiId,
        jahr,
        monat,
        status: 'GESPERRT',
        gesperrtVon: userId,
        gesperrtAm: new Date(),
      },
      update: {
        status: 'GESPERRT',
        gesperrtVon: userId,
        gesperrtAm: new Date(),
      },
    });

    await logAuditEvent({
      userId,
      aktion: 'BUCHUNGSPERIODE_GESPERRT',
      details: {
        periodeId: periode.id,
        jahr,
        monat,
      },
    });

    return NextResponse.json({ periode }, { status: 200 });
  } catch (err: any) {
    console.error('Buchungsperiode lock error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Sperren der Buchungsperiode' },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/finanzen/buchungsperioden ────────────────────────────────────
// Unlock a period (set status = OFFEN)

export async function PATCH(request: NextRequest) {
  const roleResult = await requireRole('ADMIN');
  if (roleResult.error) return roleResult.error;
  const { session } = roleResult;

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json({ error: 'Keine Kanzlei zugeordnet' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { jahr, monat } = parsed.data;
  const userId = session.user.id;

  try {
    const periode = await prisma.buchungsperiode.findUnique({
      where: {
        kanzleiId_jahr_monat: { kanzleiId, jahr, monat },
      },
    });

    if (!periode) {
      return NextResponse.json({ error: 'Buchungsperiode nicht gefunden' }, { status: 404 });
    }

    if (periode.status === 'OFFEN') {
      return NextResponse.json({ error: 'Periode ist bereits offen' }, { status: 400 });
    }

    const updated = await prisma.buchungsperiode.update({
      where: { id: periode.id },
      data: {
        status: 'OFFEN',
        gesperrtVon: null,
        gesperrtAm: null,
      },
    });

    await logAuditEvent({
      userId,
      aktion: 'BUCHUNGSPERIODE_ENTSPERRT',
      details: {
        periodeId: updated.id,
        jahr,
        monat,
      },
    });

    return NextResponse.json({ periode: updated });
  } catch (err: any) {
    console.error('Buchungsperiode unlock error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Entsperren der Buchungsperiode' },
      { status: 500 },
    );
  }
}
