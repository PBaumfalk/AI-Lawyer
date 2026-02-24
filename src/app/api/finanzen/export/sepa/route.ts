// SEPA XML Export API
// POST: Generate SEPA pain.001 (credit transfer) or pain.008 (direct debit) XML

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { generateSepaCreditTransfer, generateSepaDirectDebit } from '@/lib/finance/export/sepa';

const creditTransferSchema = z.object({
  type: z.literal('pain.001'),
  debtor: z.object({
    name: z.string().min(1),
    iban: z.string().min(15),
    bic: z.string().min(8),
  }),
  payments: z.array(z.object({
    creditorName: z.string().min(1),
    creditorIban: z.string().min(15),
    creditorBic: z.string().optional(),
    amount: z.number().positive(),
    reference: z.string().min(1),
    purpose: z.string().min(1),
  })).min(1),
  executionDate: z.string().transform((s) => new Date(s)),
});

const directDebitSchema = z.object({
  type: z.literal('pain.008'),
  creditor: z.object({
    name: z.string().min(1),
    iban: z.string().min(15),
    bic: z.string().min(8),
    creditorId: z.string().min(1),
  }),
  mandates: z.array(z.object({
    mandateId: z.string().min(1),
    creditorId: z.string().min(1),
    debtorName: z.string().min(1),
    debtorIban: z.string().min(15),
    debtorBic: z.string().optional(),
    signatureDate: z.string().transform((s) => new Date(s)),
    amount: z.number().positive(),
    reference: z.string().min(1),
    purpose: z.string().min(1),
  })).min(1),
  collectionDate: z.string().transform((s) => new Date(s)),
});

const requestSchema = z.discriminatedUnion('type', [creditTransferSchema, directDebitSchema]);

// ─── POST /api/finanzen/export/sepa ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RBAC: only ADMIN and ANWALT
  const role = (session.user as any).role;
  if (!['ADMIN', 'ANWALT'].includes(role)) {
    return NextResponse.json(
      { error: 'Keine Berechtigung fuer SEPA-Export' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let xml: string;
    let filename: string;

    if (parsed.data.type === 'pain.001') {
      const { debtor, payments, executionDate } = parsed.data;
      xml = generateSepaCreditTransfer(debtor, payments, executionDate);
      const dateStr = executionDate.toISOString().substring(0, 10);
      filename = `SEPA-CT-${dateStr}.xml`;
    } else {
      const { creditor, mandates, collectionDate } = parsed.data;
      xml = generateSepaDirectDebit(creditor, mandates, collectionDate);
      const dateStr = collectionDate.toISOString().substring(0, 10);
      filename = `SEPA-DD-${dateStr}.xml`;
    }

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('SEPA export error:', err);
    return NextResponse.json(
      { error: err.message || 'Fehler beim SEPA-Export' },
      { status: 500 },
    );
  }
}
