// Invoice Detail + Update API
// GET: Full invoice with relations
// PATCH: Edit (ENTWURF only) or status transition
// DELETE: Only ENTWURF invoices

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { requireAuth, requireAkteAccess } from '@/lib/rbac';
import { transitionInvoiceStatus } from '@/lib/finance/invoice/status-machine';
import { autoBookFromInvoice } from '@/lib/finance/aktenkonto/booking';
import { z } from 'zod';
import type { InvoicePosition, UstSummary } from '@/lib/finance/invoice/types';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const positionSchema = z.object({
  vvNr: z.string().optional(),
  beschreibung: z.string().min(1),
  menge: z.number().positive(),
  einzelpreis: z.number().min(0),
  ustSatz: z.number().min(0).max(100),
  betrag: z.number(),
});

const editSchema = z.object({
  positionen: z.array(positionSchema).optional(),
  notizen: z.string().optional(),
  zahlungszielTage: z.number().int().positive().optional(),
  empfaengerId: z.string().optional(),
});

const actionSchema = z.object({
  action: z.enum(['stellen', 'bezahlen', 'stornieren', 'mahnen']),
});

// ─── GET /api/finanzen/rechnungen/[id] ───────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    const rechnung = await prisma.rechnung.findUnique({
      where: { id },
      include: {
        akte: {
          select: {
            id: true,
            aktenzeichen: true,
            kurzrubrum: true,
            kanzlei: true,
            beteiligte: {
              where: { rolle: 'MANDANT' },
              select: {
                kontakt: {
                  select: {
                    id: true,
                    vorname: true,
                    nachname: true,
                    firma: true,
                    strasse: true,
                    plz: true,
                    ort: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
        teilzahlungen: {
          orderBy: { zahlungsdatum: 'desc' },
        },
        mahnungen: {
          orderBy: { datum: 'desc' },
        },
      },
    });

    if (!rechnung) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Verify user has access to the invoice's Akte
    const akteAccess = await requireAkteAccess(rechnung.akte.id);
    if (akteAccess.error) return akteAccess.error;

    // Calculate restBetrag from teilzahlungen
    const gezahlt = rechnung.teilzahlungen.reduce(
      (sum, tz) => sum + tz.betrag.toNumber(),
      0,
    );
    const restBetrag = rechnung.betragBrutto.toNumber() - gezahlt;

    // Format Mandant and Empfaenger
    const mandant = rechnung.akte.beteiligte[0]?.kontakt;
    const mandantName = mandant
      ? mandant.firma ?? [mandant.vorname, mandant.nachname].filter(Boolean).join(' ')
      : null;

    return NextResponse.json({
      ...rechnung,
      restBetrag: Math.max(0, Math.round(restBetrag * 100) / 100),
      mandantName,
      aktenzeichen: rechnung.akte.aktenzeichen,
      kurzrubrum: rechnung.akte.kurzrubrum,
    });
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
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  // Determine mode: action (status transition) or edit
  const actionParsed = actionSchema.safeParse(body);

  if (actionParsed.success) {
    // ── Status Transition Mode ─────────────────────────────────────────────
    const { action } = actionParsed.data;

    const statusMap: Record<string, string> = {
      stellen: 'GESTELLT',
      bezahlen: 'BEZAHLT',
      stornieren: 'STORNIERT',
      mahnen: 'MAHNUNG',
    };

    const targetStatus = statusMap[action] as any;

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
      const updated = await prisma.rechnung.findUnique({ where: { id } });

      return NextResponse.json({
        rechnung: updated,
        sideEffects: result.sideEffects,
      });
    } catch (err: any) {
      console.error('Invoice transition error:', err);
      return NextResponse.json(
        { error: err.message?.slice(0, 200) ?? 'Fehler bei der Statusaenderung' },
        { status: 500 },
      );
    }
  }

  // ── Edit Mode (ENTWURF only) ───────────────────────────────────────────────
  const editParsed = editSchema.safeParse(body);
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
        { error: 'Nur Entwuerfe koennen bearbeitet werden' },
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
        { error: 'Nur Entwuerfe koennen geloescht werden' },
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
      { error: 'Fehler beim Loeschen der Rechnung' },
      { status: 500 },
    );
  }
}
