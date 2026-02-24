// DATEV Buchungsstapel CSV Export
// Generates EXTF_ formatted CSV files for Steuerberater communication
// Format: EXTF_ header + column header + booking rows (semicolon-delimited, Windows line endings)

import { prisma } from '@/lib/db';
import { BuchungsTyp } from '@prisma/client';
import type { DatevExportOptions, DatevBooking, KontenrahmenMapping } from './types';
import { SKR03_MAPPING, SKR04_MAPPING } from './types';

/**
 * Format a number in German format (comma decimal, dot thousands)
 * e.g., 1234.56 -> "1.234,56"
 */
export function formatGermanNumber(value: number): string {
  const abs = Math.abs(value);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Add thousand separators
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${decPart}`;
}

/**
 * Format a date as DDMM for DATEV Belegdatum
 */
export function formatDatevDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}${m}`;
}

/**
 * Get the BU-Schluessel for a given USt rate
 * 9 = 19% USt, 8 = 7% USt, empty = no tax
 */
export function getBuSchluessel(ustSatz?: number): string {
  if (ustSatz === 19) return '9';
  if (ustSatz === 7) return '8';
  return '';
}

/**
 * Get the correct Kontenrahmen mapping for SKR03 or SKR04
 */
export function getKontenrahmen(skr: 'SKR03' | 'SKR04'): KontenrahmenMapping {
  return skr === 'SKR03' ? SKR03_MAPPING : SKR04_MAPPING;
}

/**
 * Map a BuchungsTyp to DATEV debit/credit indicator and account pair
 */
export function mapBuchungstypToDatev(
  buchungstyp: BuchungsTyp,
  betrag: number,
  mapping: KontenrahmenMapping,
  sachkonto?: string | null,
): { debitCredit: 'S' | 'H'; account: string; contraAccount: string } {
  // Betrag in ledger is signed: positive = income, negative = expense
  const isPositive = betrag >= 0;

  switch (buchungstyp) {
    case BuchungsTyp.EINNAHME:
      return {
        debitCredit: isPositive ? 'S' : 'H',
        account: sachkonto ?? mapping.bank,
        contraAccount: mapping.honorar,
      };
    case BuchungsTyp.AUSGABE:
      return {
        debitCredit: isPositive ? 'H' : 'S',
        account: sachkonto ?? mapping.auslagen,
        contraAccount: mapping.bank,
      };
    case BuchungsTyp.FREMDGELD:
      return {
        debitCredit: isPositive ? 'S' : 'H',
        account: sachkonto ?? mapping.bank,
        contraAccount: mapping.fremdgeld,
      };
    case BuchungsTyp.AUSLAGE:
      return {
        debitCredit: isPositive ? 'H' : 'S',
        account: sachkonto ?? mapping.auslagen,
        contraAccount: mapping.bank,
      };
    default:
      return {
        debitCredit: 'S',
        account: sachkonto ?? mapping.bank,
        contraAccount: mapping.honorar,
      };
  }
}

/**
 * Generate the EXTF_ header line for DATEV CSV
 */
export function generateExtfHeader(options: {
  periodeStart: Date;
  periodeEnd: Date;
  beraternummer: number;
  mandantennummer: number;
  kontenlaenge?: number;
}): string {
  const now = new Date();
  const created = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}000`;
  const wirtschaftsjahrBeginn = `${options.periodeStart.getFullYear()}0101`;
  const kontenlaenge = options.kontenlaenge ?? 4;

  // EXTF header fields:
  // "EXTF";700;21;"Buchungsstapel";13;created;;;;;beraternr;mandantennr;wjBeginn;kontenlaenge;periodeStart;periodeEnd;"";"";1;;
  const fields = [
    '"EXTF"',         // Kennung
    '700',            // Versionsnummer
    '21',             // Datenkategorie (Buchungsstapel)
    '"Buchungsstapel"', // Formatname
    '13',             // Formatversion
    created,          // Erzeugt
    '',               // Importiert (empty)
    '',               // Herkunft (empty)
    '',               // Exportiert von (empty)
    '',               // Importiert von (empty)
    '',               // Berater (empty)
    options.beraternummer.toString(),
    options.mandantennummer.toString(),
    wirtschaftsjahrBeginn,
    kontenlaenge.toString(),
    `${options.periodeStart.getFullYear()}${(options.periodeStart.getMonth() + 1).toString().padStart(2, '0')}${options.periodeStart.getDate().toString().padStart(2, '0')}`,
    `${options.periodeEnd.getFullYear()}${(options.periodeEnd.getMonth() + 1).toString().padStart(2, '0')}${options.periodeEnd.getDate().toString().padStart(2, '0')}`,
    '""',             // Bezeichnung
    '""',             // Diktatkuerzel
    '1',              // Buchungstyp (1 = Finanzbuchfuehrung)
    '',               // Rechnungslegungszweck
    '',               // reserved
  ];

  return fields.join(';');
}

/**
 * Generate DATEV column headers (most commonly used ~15 columns)
 */
export function generateColumnHeaders(): string {
  const columns = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schluessel)',
    'BU-Schluessel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
    'Postensperre',
    'Diverse Adressnummer',
    'Geschaeftspartnerbank',
    'Sachverhalt',
    'Zinssperre',
    'Beleglink',
    'Beleginfo - Art 1',
    'Beleginfo - Inhalt 1',
    'Kostenstelle',
  ];

  return columns.join(';');
}

/**
 * Format a single booking row as DATEV CSV
 */
export function formatBookingRow(booking: DatevBooking): string {
  const fields = [
    booking.amount,                                // Umsatz
    booking.debitCredit,                           // S/H
    booking.currency,                              // WKZ
    '',                                            // Kurs
    '',                                            // Basis-Umsatz
    '',                                            // WKZ Basis-Umsatz
    booking.account,                               // Konto
    booking.contraAccount,                         // Gegenkonto
    booking.buKey ?? '',                           // BU-Schluessel
    booking.date,                                  // Belegdatum
    booking.reference1 ?? '',                      // Belegfeld 1
    booking.reference2 ?? '',                      // Belegfeld 2
    '',                                            // Skonto
    `"${booking.text.substring(0, 60)}"`,          // Buchungstext (max 60 chars)
    '',                                            // Postensperre
    '',                                            // Diverse Adressnummer
    '',                                            // Geschaeftspartnerbank
    '',                                            // Sachverhalt
    '',                                            // Zinssperre
    '',                                            // Beleglink
    '',                                            // Beleginfo - Art 1
    '',                                            // Beleginfo - Inhalt 1
    booking.costCenter1 ?? '',                     // Kostenstelle
  ];

  return fields.join(';');
}

/**
 * Generate a complete DATEV Buchungsstapel CSV export.
 *
 * Queries AktenKontoBuchung for the specified period and generates
 * a semicolon-delimited CSV with EXTF_ header, column headers, and booking rows.
 * Uses Windows line endings (CRLF) and UTF-8 BOM for Excel compatibility.
 *
 * @param options - Export configuration (period, Kanzlei, Kontenrahmen)
 * @returns Complete CSV string with BOM
 */
export async function generateDatevExport(options: DatevExportOptions): Promise<string> {
  const mapping = getKontenrahmen(options.kontenrahmen);

  // Query bookings for the specified period
  const buchungen = await prisma.aktenKontoBuchung.findMany({
    where: {
      buchungsdatum: {
        gte: options.periodeStart,
        lte: options.periodeEnd,
      },
      akte: {
        kanzleiId: options.kanzleiId,
      },
    },
    include: {
      akte: {
        select: { aktenzeichen: true },
      },
    },
    orderBy: [{ buchungsdatum: 'asc' }, { createdAt: 'asc' }],
  });

  // Generate EXTF_ header
  const extfHeader = generateExtfHeader({
    periodeStart: options.periodeStart,
    periodeEnd: options.periodeEnd,
    beraternummer: options.beraternummer ?? 1001,
    mandantennummer: options.mandantennummer ?? 1,
  });

  // Generate column headers
  const columnHeaders = generateColumnHeaders();

  // Map bookings to DATEV rows
  const rows = buchungen.map((b) => {
    const betrag = b.betrag.toNumber();
    const { debitCredit, account, contraAccount } = mapBuchungstypToDatev(
      b.buchungstyp,
      betrag,
      mapping,
      b.kostenstelle,
    );

    const booking: DatevBooking = {
      amount: formatGermanNumber(betrag),
      debitCredit,
      currency: 'EUR',
      account,
      contraAccount,
      buKey: getBuSchluessel(),
      date: formatDatevDate(b.buchungsdatum),
      reference1: b.belegnummer ?? b.rechnungId ?? '',
      text: b.verwendungszweck,
      costCenter1: b.kostenstelle ?? undefined,
    };

    return formatBookingRow(booking);
  });

  // Combine with Windows line endings and UTF-8 BOM
  const bom = '\uFEFF';
  const lines = [extfHeader, columnHeaders, ...rows];
  return bom + lines.join('\r\n') + '\r\n';
}
