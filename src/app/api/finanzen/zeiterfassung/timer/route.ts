// Timer API
// GET: Get active timer for current user
// POST: Start timer for an Akte
// PATCH: Stop timer (with optional beschreibung)
// PUT: Switch timer to a different Akte

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { startTimer, stopTimer, switchTimer, getActiveTimer } from '@/lib/finance/time-tracking/timer';

const startSchema = z.object({
  akteId: z.string().min(1, 'akteId ist erforderlich'),
});

const stopSchema = z.object({
  beschreibung: z.string().optional(),
});

const switchSchema = z.object({
  akteId: z.string().min(1, 'akteId ist erforderlich'),
});

// ─── GET /api/finanzen/zeiterfassung/timer ───────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const timer = await getActiveTimer(session.user.id);

    if (!timer) {
      return NextResponse.json({ timer: null });
    }

    return NextResponse.json({ timer });
  } catch (err: any) {
    console.error('Timer GET error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Timers' },
      { status: 500 },
    );
  }
}

// ─── POST /api/finanzen/zeiterfassung/timer ──────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = startSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const timer = await startTimer(session.user.id, parsed.data.akteId);

    return NextResponse.json({ timer }, { status: 201 });
  } catch (err: any) {
    console.error('Timer start error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim Starten des Timers' },
      { status: err.message?.includes('nicht gefunden') ? 404 : 500 },
    );
  }
}

// ─── PATCH /api/finanzen/zeiterfassung/timer ─────────────────────────────────

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = stopSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const entry = await stopTimer(session.user.id, parsed.data.beschreibung);

    return NextResponse.json({
      id: entry.id,
      akteId: entry.akteId,
      dauer: entry.dauer,
      beschreibung: entry.beschreibung,
      startzeit: entry.startzeit,
      endzeit: entry.endzeit,
    });
  } catch (err: any) {
    console.error('Timer stop error:', err);

    // Stundenhonorar validation error returns 400
    if (err.message?.includes('Taetigkeitsbeschreibung ist Pflicht')) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: err.message || 'Fehler beim Stoppen des Timers' },
      { status: err.message?.includes('Kein aktiver Timer') ? 404 : 500 },
    );
  }
}

// ─── PUT /api/finanzen/zeiterfassung/timer ───────────────────────────────────

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = switchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await switchTimer(session.user.id, parsed.data.akteId);

    return NextResponse.json({
      stopped: result.stopped
        ? {
            id: result.stopped.id,
            akteId: result.stopped.akteId,
            dauer: result.stopped.dauer,
          }
        : null,
      started: result.started,
    });
  } catch (err: any) {
    console.error('Timer switch error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim Wechseln des Timers' },
      { status: 500 },
    );
  }
}
