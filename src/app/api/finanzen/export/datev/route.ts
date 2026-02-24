// DATEV Buchungsstapel CSV Export API
// POST: Generate DATEV-formatted CSV for the specified period

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { generateDatevExport } from '@/lib/finance/export/datev';

const exportSchema = z.object({
  periodeStart: z.string().transform((s) => new Date(s)),
  periodeEnd: z.string().transform((s) => new Date(s)),
  kontenrahmen: z.enum(['SKR03', 'SKR04']),
  beraternummer: z.number().int().optional(),
  mandantennummer: z.number().int().optional(),
});

// ─── POST /api/finanzen/export/datev ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RBAC: only ADMIN and ANWALT
  const role = (session.user as any).role;
  if (!['ADMIN', 'ANWALT'].includes(role)) {
    return NextResponse.json(
      { error: 'Keine Berechtigung fuer DATEV-Export' },
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
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { periodeStart, periodeEnd, kontenrahmen, beraternummer, mandantennummer } = parsed.data;

    const csv = await generateDatevExport({
      periodeStart,
      periodeEnd,
      kanzleiId,
      kontenrahmen,
      beraternummer,
      mandantennummer,
    });

    // Format period for filename
    const von = periodeStart.toISOString().substring(0, 10);
    const bis = periodeEnd.toISOString().substring(0, 10);
    const filename = `DATEV-Buchungsstapel-${von}_${bis}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('DATEV export error:', err);
    return NextResponse.json(
      { error: 'Fehler beim DATEV-Export' },
      { status: 500 },
    );
  }
}
