// Kostenstellen (Cost Centers) API
// GET: List active Kostenstellen with usage count
// POST: Create new Kostenstelle (ADMIN only)
// PATCH: Update Kostenstelle (ADMIN only)
// DELETE: Deactivate Kostenstelle (never hard delete)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/rbac';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  beschreibung: z.string().optional(),
  sachkonto: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  beschreibung: z.string().optional(),
  sachkonto: z.string().optional(),
  aktiv: z.boolean().optional(),
});

// ─── GET /api/finanzen/kostenstellen ─────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json({ error: 'Keine Kanzlei zugeordnet' }, { status: 400 });
  }

  try {
    const kostenstellen = await prisma.kostenstelle.findMany({
      where: { kanzleiId },
      orderBy: { name: 'asc' },
    });

    // Get usage count for each Kostenstelle
    const mitCounts = await Promise.all(
      kostenstellen.map(async (ks) => {
        const usageCount = await prisma.aktenKontoBuchung.count({
          where: { kostenstelle: ks.name },
        });

        return {
          ...ks,
          usageCount,
        };
      }),
    );

    return NextResponse.json({ kostenstellen: mitCounts });
  } catch (err: any) {
    console.error('Kostenstellen list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Kostenstellen' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/kostenstellen ────────────────────────────────────────

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  try {
    const kostenstelle = await prisma.kostenstelle.create({
      data: {
        kanzleiId,
        name: data.name,
        beschreibung: data.beschreibung ?? null,
        sachkonto: data.sachkonto ?? null,
      },
    });

    await logAuditEvent({
      userId,
      aktion: 'KOSTENSTELLE_ERSTELLT',
      details: {
        kostenstelleId: kostenstelle.id,
        name: data.name,
      },
    });

    return NextResponse.json({ kostenstelle }, { status: 201 });
  } catch (err: any) {
    console.error('Kostenstelle create error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Kostenstelle' },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/finanzen/kostenstellen ───────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const roleResult = await requireRole('ADMIN');
  if (roleResult.error) return roleResult.error;
  const { session } = roleResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, ...updateFields } = parsed.data;
  const userId = session.user.id;

  try {
    const existing = await prisma.kostenstelle.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Kostenstelle nicht gefunden' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (updateFields.name !== undefined) updateData.name = updateFields.name;
    if (updateFields.beschreibung !== undefined) updateData.beschreibung = updateFields.beschreibung;
    if (updateFields.sachkonto !== undefined) updateData.sachkonto = updateFields.sachkonto;
    if (updateFields.aktiv !== undefined) updateData.aktiv = updateFields.aktiv;

    const updated = await prisma.kostenstelle.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      userId,
      aktion: 'KOSTENSTELLE_GEAENDERT',
      details: {
        kostenstelleId: id,
        changedFields: Object.keys(updateData),
      },
    });

    return NextResponse.json({ kostenstelle: updated });
  } catch (err: any) {
    console.error('Kostenstelle update error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Bearbeiten der Kostenstelle' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/finanzen/kostenstellen ──────────────────────────────────────
// Deactivates the Kostenstelle (soft delete). Never hard-deletes if bookings reference it.

export async function DELETE(request: NextRequest) {
  const roleResult = await requireRole('ADMIN');
  if (roleResult.error) return roleResult.error;
  const { session } = roleResult;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID Parameter fehlt' }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    const existing = await prisma.kostenstelle.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Kostenstelle nicht gefunden' }, { status: 404 });
    }

    // Soft delete: set aktiv = false
    await prisma.kostenstelle.update({
      where: { id },
      data: { aktiv: false },
    });

    await logAuditEvent({
      userId,
      aktion: 'KOSTENSTELLE_DEAKTIVIERT',
      details: {
        kostenstelleId: id,
        name: existing.name,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Kostenstelle deactivate error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Deaktivieren der Kostenstelle' },
      { status: 500 },
    );
  }
}
