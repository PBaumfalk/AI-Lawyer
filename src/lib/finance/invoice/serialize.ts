// Server-side mapping from Prisma invoice records to the API DTOs in ./contract.
// Converts Prisma Decimal to number (EUR) and Date to ISO string, so the client
// never receives Decimal strings or has to guess field names.

import type { Prisma, Rechnung, RechnungStatus } from '@prisma/client';
import type {
  InvoiceDetailDto,
  InvoiceListItemDto,
  MahnStufeDto,
  RechnungStatusDto,
} from './contract';
import { xrechnungErlaubt } from './contract';
import type { InvoicePosition, UstSummary } from './types';
import { erlaubteAktionen } from './status-machine';

type Kontaktname = { vorname: string | null; nachname: string | null; firma: string | null } | null | undefined;

export function kontaktName(k: Kontaktname): string | null {
  if (!k) return null;
  return k.firma ?? ([k.vorname, k.nachname].filter(Boolean).join(' ') || null);
}

const num = (d: Prisma.Decimal | null | undefined): number => (d ? d.toNumber() : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Outstanding amount: nothing is owed on paid, cancelled or draft invoices;
 * otherwise gross minus recorded partial payments (never below zero).
 */
export function offenerBetrag(
  status: RechnungStatus,
  betragBrutto: number,
  gezahlt: number,
): number {
  if (status !== 'GESTELLT' && status !== 'MAHNUNG') return 0;
  return Math.max(0, round2(betragBrutto - gezahlt));
}

type ListRow = Rechnung & {
  akte: {
    aktenzeichen: string;
    kurzrubrum: string | null;
    beteiligte: { kontakt: Kontaktname }[];
  };
};

export function toInvoiceListItem(r: ListRow, gezahlt?: number): InvoiceListItemDto {
  const brutto = num(r.betragBrutto);
  const rest =
    gezahlt !== undefined
      ? offenerBetrag(r.status, brutto, gezahlt)
      : r.status === 'GESTELLT' || r.status === 'MAHNUNG'
        ? num(r.restBetrag ?? r.betragBrutto)
        : 0;
  return {
    id: r.id,
    akteId: r.akteId,
    rechnungsnummer: r.rechnungsnummer,
    rechnungsdatum: r.rechnungsdatum.toISOString(),
    faelligAm: r.faelligAm ? r.faelligAm.toISOString() : null,
    status: r.status as RechnungStatusDto,
    mahnStufe: (r.mahnStufe as MahnStufeDto | null) ?? null,
    betragNetto: num(r.betragNetto),
    betragBrutto: brutto,
    restBetrag: rest,
    stornoVon: r.stornoVon,
    mandantName: kontaktName(r.akte.beteiligte[0]?.kontakt),
    aktenzeichen: r.akte.aktenzeichen,
    kurzrubrum: r.akte.kurzrubrum,
  };
}

type Anschrift = Kontaktname & { strasse?: string | null; plz?: string | null; ort?: string | null };

type DetailRow = ListRow & {
  teilzahlungen: { id: string; betrag: Prisma.Decimal; zahlungsdatum: Date; verwendungszweck: string | null }[];
  mahnungen: { id: string; stufe: string; datum: Date; gesendetAm: Date | null }[];
};

export function toInvoiceDetail(r: DetailRow, empfaengerKontakt: Anschrift | null): InvoiceDetailDto {
  const gezahlt = r.teilzahlungen.reduce((s, tz) => s + tz.betrag.toNumber(), 0);
  const empfaenger = empfaengerKontakt ?? (r.akte.beteiligte[0]?.kontakt as Anschrift | undefined) ?? null;
  const name = kontaktName(empfaenger);
  return {
    ...toInvoiceListItem(r, gezahlt),
    notizen: r.notizen,
    empfaenger:
      empfaenger && name
        ? { name, strasse: empfaenger.strasse ?? null, plz: empfaenger.plz ?? null, ort: empfaenger.ort ?? null }
        : null,
    positionen: (Array.isArray(r.positionen) ? r.positionen : []) as unknown as InvoicePosition[],
    ustSummary: (Array.isArray(r.ustSummary) ? r.ustSummary : []) as unknown as UstSummary[],
    teilzahlungen: r.teilzahlungen.map((tz) => ({
      id: tz.id,
      betrag: tz.betrag.toNumber(),
      zahlungsdatum: tz.zahlungsdatum.toISOString(),
      verwendungszweck: tz.verwendungszweck,
    })),
    mahnungen: r.mahnungen.map((m) => ({
      id: m.id,
      stufe: m.stufe as MahnStufeDto,
      datum: m.datum.toISOString(),
      gesendetAm: m.gesendetAm ? m.gesendetAm.toISOString() : null,
    })),
    erlaubteAktionen: erlaubteAktionen(r.status, r.mahnStufe),
    downloads: { pdf: true, xrechnung: xrechnungErlaubt(r.status as RechnungStatusDto) },
  };
}
