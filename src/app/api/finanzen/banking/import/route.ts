// Bank Statement Import API
// POST: Import bank CSV or CAMT.053 XML, detect format, deduplicate, store transactions

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseBankCsv } from '@/lib/finance/banking/csv-parser';
import { parseCamt053 } from '@/lib/finance/banking/camt-parser';
import { findDuplicates } from '@/lib/finance/banking/dedup';
import type { BankTransaction } from '@/lib/finance/banking/types';

// ─── POST /api/finanzen/banking/import ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RBAC: ADMIN and ANWALT
  const role = (session.user as any).role;
  if (!['ADMIN', 'ANWALT'].includes(role)) {
    return NextResponse.json(
      { error: 'Keine Berechtigung fuer Bankimport' },
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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankKontoId = formData.get('bankKontoId') as string | null;
    const formatOverride = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 },
      );
    }

    if (!bankKontoId) {
      return NextResponse.json(
        { error: 'bankKontoId ist erforderlich' },
        { status: 400 },
      );
    }

    // Verify bank account belongs to the user's Kanzlei
    const bankKonto = await prisma.bankKonto.findFirst({
      where: { id: bankKontoId, kanzleiId },
    });

    if (!bankKonto) {
      return NextResponse.json(
        { error: 'Bankkonto nicht gefunden' },
        { status: 404 },
      );
    }

    const content = await file.text();
    const filename = file.name.toLowerCase();

    // Parse based on file type
    let transactions: BankTransaction[];
    if (filename.endsWith('.xml') || filename.endsWith('.camt')) {
      transactions = parseCamt053(content);
    } else {
      transactions = parseBankCsv(content, formatOverride ?? undefined);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'Keine Transaktionen in der Datei gefunden' },
        { status: 400 },
      );
    }

    // Deduplicate
    const { unique, duplicates } = await findDuplicates(transactions);

    // Store unique transactions
    if (unique.length > 0) {
      await prisma.bankTransaktion.createMany({
        data: unique.map((tx) => ({
          bankKontoId,
          buchungsdatum: tx.buchungsdatum,
          wertstellung: tx.wertstellung ?? null,
          betrag: tx.betrag,
          verwendungszweck: tx.verwendungszweck,
          absenderEmpfaenger: tx.absenderEmpfaenger ?? null,
          saldo: tx.saldo ?? null,
          importHash: tx.importHash,
        })),
      });
    }

    return NextResponse.json({
      imported: unique.length,
      duplicates: duplicates.length,
      total: transactions.length,
      bankKontoId,
    });
  } catch (err: any) {
    console.error('Bank import error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim Bankimport' },
      { status: 500 },
    );
  }
}
