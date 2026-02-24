// E-Rechnung XML Download API
// GET: Generate and return XRechnung CII XML for a given invoice
// Only GESTELLT or BEZAHLT invoices may generate E-Rechnung (not ENTWURF)
// Requires Kanzlei to have Steuernummer or UStIdNr set

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateXRechnungXml } from '@/lib/finance/invoice/e-rechnung';
import type {
  InvoiceKanzleiData,
  InvoiceRecipientData,
  InvoicePosition,
  UstSummary,
  InvoiceData,
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

    // Only GESTELLT or BEZAHLT invoices can generate E-Rechnung
    if (rechnung.status !== 'GESTELLT' && rechnung.status !== 'BEZAHLT') {
      return NextResponse.json(
        {
          error: `E-Rechnung nur fuer gestellte oder bezahlte Rechnungen verfuegbar. Aktueller Status: ${rechnung.status}`,
        },
        { status: 400 },
      );
    }

    // Validate Kanzlei has Steuernummer or UStIdNr (required for E-Rechnung)
    const kanzlei = rechnung.akte.kanzlei;
    if (!kanzlei?.steuernr && !kanzlei?.ustIdNr) {
      return NextResponse.json(
        {
          error:
            'Kanzlei muss Steuernummer oder USt-IdNr konfiguriert haben fuer E-Rechnung-Erstellung. Bitte in den Kanzlei-Einstellungen hinterlegen.',
        },
        { status: 400 },
      );
    }

    // Build kanzlei data
    const kanzleiData: InvoiceKanzleiData = {
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
    };

    // Build empfaenger data
    const mandant = rechnung.akte.beteiligte[0]?.kontakt;
    const mandantName = mandant
      ? mandant.firma ?? [mandant.vorname, mandant.nachname].filter(Boolean).join(' ')
      : 'Unbekannt';

    let empfaengerData: InvoiceRecipientData = {
      name: mandantName,
      strasse: mandant?.strasse ?? undefined,
      plz: mandant?.plz ?? undefined,
      ort: mandant?.ort ?? undefined,
      land: mandant?.land ?? undefined,
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
          name:
            empfKontakt.firma ??
            [empfKontakt.vorname, empfKontakt.nachname].filter(Boolean).join(' '),
          strasse: empfKontakt.strasse ?? undefined,
          plz: empfKontakt.plz ?? undefined,
          ort: empfKontakt.ort ?? undefined,
          land: empfKontakt.land ?? undefined,
        };
      }
    }

    // Build InvoiceData
    const positionen = (rechnung.positionen as unknown as InvoicePosition[]) ?? [];
    const ustSummary = (rechnung.ustSummary as unknown as UstSummary[]) ?? [];

    const invoiceData: InvoiceData = {
      rechnungsnummer: rechnung.rechnungsnummer,
      rechnungsdatum: rechnung.rechnungsdatum,
      faelligAm: rechnung.faelligAm,
      zahlungszielTage: rechnung.zahlungszielTage,
      aktenzeichen: rechnung.akte.aktenzeichen,
      mandantName,
      kanzlei: kanzleiData,
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

    // Generate XRechnung CII XML
    const xml = await generateXRechnungXml(invoiceData, kanzleiData, empfaengerData);

    // Return XML with proper headers
    const safeFilename = rechnung.rechnungsnummer.replace(/[^a-zA-Z0-9\-_]/g, '_');
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="XRechnung-${safeFilename}.xml"`,
        'Content-Length': String(new TextEncoder().encode(xml).length),
      },
    });
  } catch (err: any) {
    console.error('E-Rechnung generation error:', err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? 'Fehler beim Erstellen der E-Rechnung' },
      { status: 500 },
    );
  }
}
