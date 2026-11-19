// Invoice Detail + Update API
// GET: Full invoice with relations
// PATCH: Edit (ENTWURF only) or status transition
// DELETE: Only ENTWURF invoices

import { NextRequest, NextResponse } from 'next/server';
import { loeschenVerweigert } from "@/lib/rbac";
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireAkteAccess } from '@/lib/rbac';
import { transitionInvoiceStatus, ACTION_TARGET_STATUS } from '@/lib/finance/invoice/status-machine';
import { autoBookFromInvoice } from '@/lib/finance/aktenkonto/booking';
import type { InvoicePosition, UstSummary } from '@/lib/finance/invoice/types';
import {
  editInvoiceSchema,
  invoiceActionSchema,
  type InvoiceActionResponse,
  type InvoiceDetailDto,
} from '@/lib/finance/invoice/contract';
import { toInvoiceDetail } from '@/lib/finance/invoice/serialize';

/** Load an invoice with everything the detail view needs, as DTO. */
async function loadInvoiceDetail(id: string): Promise<{ akteId: string; dto: InvoiceDetailDto } | null> {
  const rechnung = await prisma.rechnung.findUnique({
    where: { id },
    include: {
      akte: {
        select: {
          aktenzeichen: true,
          kurzrubrum: true,
          beteiligte: {
            where: { rolle: 'MANDANT' },
            select: {
              kontakt: {
                select: { vorname: true, nachname: true, firma: true, strasse: true, plz: true, ort: true },
              },
            },
            take: 1,
          },
        },
      },
      teilzahlungen: { orderBy: { zahlungsdatum: 'desc' } },
      mahnungen: { orderBy: { datum: 'desc' } },
    },
  });
  if (!rechnung) return null;

  const empfaenger = rechnung.empfaengerId
    ? await prisma.kontakt.findUnique({
        where: { id: rechnung.empfaengerId },
        select: { vorname: true, nachname: true, firma: true, strasse: true, plz: true, ort: true },
      })
    : null;

  return { akteId: rechnung.akteId, dto: toInvoiceDetail(rechnung, empfaenger) };
}

// ─── GET /api/finanzen/rechnungen/[id] ───────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    const loaded = await loadInvoiceDetail(id);
    if (!loaded) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Verify user has access to the invoice's Akte
    const akteAccess = await requireAkteAccess(loaded.akteId);
    if (akteAccess.error) return akteAccess.error;

    return NextResponse.json<InvoiceDetailDto>(loaded.dto);
  } catch (err: any) {
    console.error('Invoice detail error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Rechnung' },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/finanzen/rechnungen/[id] ─────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  // Determine mode: action (status transition) or edit
  const actionParsed = invoiceActionSchema.safeParse(body);

  if (actionParsed.success) {
    // ── Status Transition Mode ─────────────────────────────────────────────
    const { action } = actionParsed.data;

    const targetStatus = ACTION_TARGET_STATUS[action];

    try {
      // Load Kanzlei settings for Storno pattern
      const rechnung = await prisma.rechnung.findUnique({
        where: { id },
        include: {
          akte: {
            select: {
              id: true,
              kanzlei: { select: { stornoPattern: true } },
            },
          },
        },
      });

      if (!rechnung) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }

      // Verify user has access to the invoice's Akte
      const akteAccess = await requireAkteAccess(rechnung.akte.id);
      if (akteAccess.error) return akteAccess.error;

      const stornoPattern = rechnung.akte.kanzlei?.stornoPattern ?? undefined;

      const result = await prisma.$transaction(async (tx) => {
        const transitionResult = await transitionInvoiceStatus(tx, id, targetStatus, userId, stornoPattern);
        // Auto-book Aktenkonto entry on successful status transition
        if (transitionResult.success) {
          await autoBookFromInvoice(tx, id, action, userId);
        }
        return transitionResult;
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Reload updated invoice
      const updated = await loadInvoiceDetail(id);
      if (!updated) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json<InvoiceActionResponse>({
        rechnung: updated.dto,
        sideEffects: result.sideEffects,
      });
    } catch (err: any) {
      console.error('Invoice transition error:', err);
      return NextResponse.json(
        { error: err.message?.slice(0, 200) ?? 'Fehler bei der Statusänderung' },
        { status: 500 },
      );
    }
  }

  // ── Edit Mode (ENTWURF only) ───────────────────────────────────────────────
  const editParsed = editInvoiceSchema.safeParse(body);
  if (!editParsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: editParsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = editParsed.data;

  try {
    const rechnung = await prisma.rechnung.findUnique({ where: { id } });

    if (!rechnung) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Verify user has access to the invoice's Akte
    const editAkteAccess = await requireAkteAccess(rechnung.akteId);
    if (editAkteAccess.error) return editAkteAccess.error;

    if (rechnung.status !== 'ENTWURF') {
      return NextResponse.json(
        { error: 'Nur Entwürfe können bearbeitet werden' },
        { status: 400 },
      );
    }

    // Recalculate totals if positionen changed
    const updateData: Record<string, any> = {};

    if (data.positionen) {
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

      updateData.positionen = positionen;
      updateData.ustSummary = ustSummary;
      updateData.betragNetto = betragNetto;
      updateData.betragBrutto = betragBrutto;
      updateData.restBetrag = betragBrutto;
    }

    if (data.notizen !== undefined) updateData.notizen = data.notizen;
    if (data.zahlungszielTage !== undefined) updateData.zahlungszielTage = data.zahlungszielTage;
    if (data.empfaengerId !== undefined) updateData.empfaengerId = data.empfaengerId;

    const updated = await prisma.rechnung.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      userId,
      akteId: rechnung.akteId,
      aktion: 'RECHNUNG_BEARBEITET',
      details: {
        rechnungId: id,
        rechnungsnummer: rechnung.rechnungsnummer,
        changedFields: Object.keys(updateData),
      },
    });

    return NextResponse.json({ rechnung: updated });
  } catch (err: any) {
    console.error('Invoice edit error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Bearbeiten der Rechnung' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/finanzen/rechnungen/[id] ────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const loeschVerbot = await loeschenVerweigert();
  if (loeschVerbot) return loeschVerbot;

  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;
  const userId = session.user.id;

  try {
    const rechnung = await prisma.rechnung.findUnique({ where: { id } });

    if (!rechnung) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Verify user has access to the invoice's Akte
    const deleteAkteAccess = await requireAkteAccess(rechnung.akteId);
    if (deleteAkteAccess.error) return deleteAkteAccess.error;

    if (rechnung.status !== 'ENTWURF') {
      return NextResponse.json(
        { error: 'Nur Entwürfe können gelöscht werden' },
        { status: 400 },
      );
    }

    await prisma.rechnung.delete({ where: { id } });

    await logAuditEvent({
      userId,
      akteId: rechnung.akteId,
      aktion: 'RECHNUNG_GELOESCHT',
      details: {
        rechnungId: id,
        rechnungsnummer: rechnung.rechnungsnummer,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Invoice delete error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Rechnung' },
      { status: 500 },
    );
  }
}
