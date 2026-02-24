// Invoice PDF Download API
// GET: Generate and return invoice PDF with Briefkopf
// Also stores PDF in MinIO and links as dokumentId on the invoice

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateInvoicePdf } from '@/lib/finance/invoice/pdf-generator';
import { uploadFile } from '@/lib/storage';
import type {
  InvoiceData,
  InvoicePosition,
  UstSummary,
} from '@/lib/finance/invoice/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Load invoice with full relations
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
                    vorname: true,
                    nachname: true,
                    firma: true,
                    strasse: true,
                    plz: true,
                    ort: true,
                    land: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!rechnung) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    // Build InvoiceData from DB records
    const kanzlei = rechnung.akte.kanzlei;
    const mandant = rechnung.akte.beteiligte[0]?.kontakt;
    const mandantName = mandant
      ? mandant.firma ?? [mandant.vorname, mandant.nachname].filter(Boolean).join(' ')
      : 'Unbekannt';

    // Use empfaenger if set, otherwise fall back to Mandant
    let empfaengerData = {
      name: mandantName,
      strasse: mandant?.strasse ?? null,
      plz: mandant?.plz ?? null,
      ort: mandant?.ort ?? null,
      land: mandant?.land ?? null,
    };

    if (rechnung.empfaengerId) {
      const empfKontakt = await prisma.kontakt.findUnique({
        where: { id: rechnung.empfaengerId },
        select: {
          vorname: true,
          nachname: true,
          firma: true,
          strasse: true,
          plz: true,
          ort: true,
          land: true,
        },
      });
      if (empfKontakt) {
        empfaengerData = {
          name: empfKontakt.firma ??
            [empfKontakt.vorname, empfKontakt.nachname].filter(Boolean).join(' '),
          strasse: empfKontakt.strasse,
          plz: empfKontakt.plz,
          ort: empfKontakt.ort,
          land: empfKontakt.land,
        };
      }
    }

    const positionen = (rechnung.positionen as unknown as InvoicePosition[]) ?? [];
    const ustSummary = (rechnung.ustSummary as unknown as UstSummary[]) ?? [];

    const invoiceData: InvoiceData = {
      rechnungsnummer: rechnung.rechnungsnummer,
      rechnungsdatum: rechnung.rechnungsdatum,
      faelligAm: rechnung.faelligAm,
      zahlungszielTage: rechnung.zahlungszielTage,
      aktenzeichen: rechnung.akte.aktenzeichen,
      mandantName,
      kanzlei: {
        name: kanzlei?.name ?? 'Kanzlei',
        strasse: kanzlei?.strasse,
        plz: kanzlei?.plz,
        ort: kanzlei?.ort,
        telefon: kanzlei?.telefon,
        email: kanzlei?.email,
        steuernr: kanzlei?.steuernr,
        ustIdNr: kanzlei?.ustIdNr,
        bankName: kanzlei?.bankName,
        iban: kanzlei?.iban,
        bic: kanzlei?.bic,
        logo: kanzlei?.logo,
      },
      empfaenger: empfaengerData,
      positionen,
      betragNetto: rechnung.betragNetto.toNumber(),
      ustSummary,
      betragBrutto: rechnung.betragBrutto.toNumber(),
      notizen: rechnung.notizen,
      isPkh: rechnung.isPkh,
      isStorno: !!rechnung.stornoVon,
      stornoVon: rechnung.stornoVon,
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    // Upload to MinIO (non-blocking for the response, but we try)
    const storageKey = `rechnungen/${rechnung.akteId}/${rechnung.rechnungsnummer.replace(/\//g, '-')}.pdf`;
    try {
      await uploadFile(storageKey, pdfBuffer, 'application/pdf', pdfBuffer.length);

      // Link PDF to invoice if not already linked
      if (!rechnung.dokumentId) {
        await prisma.rechnung.update({
          where: { id },
          data: { dokumentId: storageKey },
        });
      }
    } catch (uploadErr) {
      // Non-fatal: PDF still returned even if storage fails
      console.warn('Invoice PDF upload to MinIO failed:', uploadErr);
    }

    // Return PDF response (convert Buffer to Uint8Array for NextResponse compatibility)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${rechnung.rechnungsnummer}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('Invoice PDF generation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Erstellen der PDF' },
      { status: 500 },
    );
  }
}
