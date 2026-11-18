// Aktenkonto Storno Endpoint
// POST: Create a reversal booking for an existing entry (ANWALT/ADMIN only)

import { NextRequest, NextResponse } from 'next/server';
import { akteAccessDenied } from "@/lib/rbac";
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stornoBooking } from '@/lib/finance/aktenkonto/booking';
import { calculateSaldo } from '@/lib/finance/aktenkonto/saldo';
import { stornoSchema } from '@/lib/finance/aktenkonto/contract';

// ─── POST /api/finanzen/aktenkonto/[akteId]/storno ──────────────────────────

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
  const userRole = (session.user as any).role;

  // RBAC: Only ANWALT and ADMIN can perform Storno
  if (userRole !== 'ANWALT' && userRole !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Keine Berechtigung. Nur Anwaelte und Administratoren koennen Stornierungen durchfuehren.' },
      { status: 403 },
    );
  }

  const denied = await akteAccessDenied(session, akteId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = stornoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { buchungId, grund } = parsed.data;

  try {
    // Validate the original booking belongs to this Akte
    const originalBuchung = await prisma.aktenKontoBuchung.findUnique({
      where: { id: buchungId },
    });

    if (!originalBuchung) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    if (originalBuchung.akteId !== akteId) {
      return NextResponse.json(
        { error: 'Buchung gehoert nicht zu dieser Akte' },
        { status: 400 },
      );
    }

    // Perform Storno within transaction
    const stornoBuchung = await prisma.$transaction(async (tx) => {
      return stornoBooking(tx, {
        originalId: buchungId,
        grund,
        userId,
      });
    });

    // Return Storno booking + updated saldo
    const saldo = await calculateSaldo(akteId);

    return NextResponse.json(
      {
        stornoBuchung: {
          ...stornoBuchung,
          betrag: stornoBuchung.betrag.toNumber(),
        },
        saldo,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Aktenkonto storno error:', err);

    // Handle known error messages
    if (err.message?.includes('bereits storniert')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler bei der Stornierung' },
      { status: 500 },
    );
  }
}
