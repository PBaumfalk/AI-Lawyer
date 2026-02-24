// Taetigkeitskategorien (Activity Categories) API
// GET: List active categories (with defaults if none exist)
// POST: Create category (ADMIN only)
// PATCH: Update category (ADMIN only)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  abrechenbar: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  abrechenbar: z.boolean().optional(),
  aktiv: z.boolean().optional(),
});

/** Default categories if no custom categories exist */
const DEFAULT_KATEGORIEN = [
  { name: 'Schriftsatz', abrechenbar: true },
  { name: 'Telefonat', abrechenbar: true },
  { name: 'Besprechung', abrechenbar: true },
  { name: 'Recherche', abrechenbar: true },
  { name: 'Gericht', abrechenbar: true },
  { name: 'Reise', abrechenbar: true },
  { name: 'Sonstiges', abrechenbar: false },
];

// ─── GET /api/finanzen/taetigkeitskategorien ─────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const kanzleiId = (session.user as any).kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json(
      { error: 'Keine Kanzlei zugeordnet' },
      { status: 400 },
    );
  }

  try {
    let kategorien = await prisma.taetigkeitskategorie.findMany({
      where: { kanzleiId, aktiv: true },
      orderBy: { name: 'asc' },
    });

    // If no categories exist, seed defaults
    if (kategorien.length === 0) {
      await prisma.taetigkeitskategorie.createMany({
        data: DEFAULT_KATEGORIEN.map((k) => ({
          kanzleiId,
          name: k.name,
          abrechenbar: k.abrechenbar,
        })),
      });

      kategorien = await prisma.taetigkeitskategorie.findMany({
        where: { kanzleiId, aktiv: true },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({
      kategorien: kategorien.map((k) => ({
        id: k.id,
        name: k.name,
        abrechenbar: k.abrechenbar,
        aktiv: k.aktiv,
      })),
    });
  } catch (err: any) {
    console.error('Taetigkeitskategorien list error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Kategorien' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/taetigkeitskategorien ────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // ADMIN only
  const role = (session.user as any).role;
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nur Administratoren koennen Kategorien erstellen' },
      { status: 403 },
    );
  }

  const kanzleiId = (session.user as any).kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json(
      { error: 'Keine Kanzlei zugeordnet' },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const kategorie = await prisma.taetigkeitskategorie.create({
      data: {
        kanzleiId,
        name: parsed.data.name,
        abrechenbar: parsed.data.abrechenbar,
      },
    });

    return NextResponse.json(
      {
        id: kategorie.id,
        name: kategorie.name,
        abrechenbar: kategorie.abrechenbar,
        aktiv: kategorie.aktiv,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Taetigkeitskategorie create error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Kategorie' },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/finanzen/taetigkeitskategorien ───────────────────────────────

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // ADMIN only
  const role = (session.user as any).role;
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Nur Administratoren koennen Kategorien bearbeiten' },
      { status: 403 },
    );
  }

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

    const kategorie = await prisma.taetigkeitskategorie.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      id: kategorie.id,
      name: kategorie.name,
      abrechenbar: kategorie.abrechenbar,
      aktiv: kategorie.aktiv,
    });
  } catch (err: any) {
    console.error('Taetigkeitskategorie update error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim Aktualisieren der Kategorie' },
      { status: 500 },
    );
  }
}
