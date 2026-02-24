// Bank CSV Parser
// Multi-format bank statement CSV import with auto-detection
// Handles German number format (comma decimal, dot thousands) and various date formats

import type { BankTransaction, BankFormat } from './types';
import { BANK_FORMATS } from './types';

/**
 * Parse a German-formatted number string into a float.
 * Handles: "1.234,56" -> 1234.56, "-500,00" -> -500.00, "1234,56" -> 1234.56
 */
export function parseGermanNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove thousand separators (dots), replace comma with dot for decimal
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a date string according to the specified format.
 * Supports: DD.MM.YYYY, DD.MM.YY, YYYY-MM-DD
 */
export function parseDate(value: string, format: string): Date {
  const trimmed = value.trim();

  if (format === 'YYYY-MM-DD') {
    return new Date(trimmed);
  }

  // DD.MM.YYYY or DD.MM.YY
  const parts = trimmed.split('.');
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    // Handle 2-digit year
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    return new Date(year, month, day);
  }

  // Fallback: try native parsing
  return new Date(trimmed);
}

/**
 * Detect the bank format from CSV content by matching header patterns.
 *
 * Checks the first line of the CSV against known column name patterns
 * for Sparkasse, VR-Bank, Deutsche Bank, Commerzbank, or generic.
 *
 * @param csvContent - Raw CSV string
 * @returns Format key (e.g., "sparkasse", "vrbank", "generic")
 */
export function detectBankFormat(csvContent: string): string {
  const firstLine = csvContent.split('\n')[0]?.toLowerCase() ?? '';

  // Sparkasse: has "Beguenstigter/Zahlungspflichtiger" or similar
  if (firstLine.includes('beguenstigter/zahlungspflichtiger') || firstLine.includes('begünstigter/zahlungspflichtiger')) {
    return 'sparkasse';
  }

  // VR-Bank: has "Vorgang/Verwendungszweck" or "Empfaenger/Zahlungspflichtiger"
  if (firstLine.includes('vorgang/verwendungszweck') || firstLine.includes('empfaenger/zahlungspflichtiger') || firstLine.includes('empfänger/zahlungspflichtiger')) {
    return 'vrbank';
  }

  // Deutsche Bank: has "Betrag (EUR)" or "Saldo (EUR)"
  if (firstLine.includes('betrag (eur)') || firstLine.includes('saldo (eur)')) {
    return 'deutschebank';
  }

  // Commerzbank: has "Buchungstext" as purpose column
  if (firstLine.includes('buchungstext') && firstLine.includes('auftraggeber')) {
    return 'commerzbank';
  }

  return 'generic';
}

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Find column index by name (case-insensitive, partial match).
 */
function findColumnIndex(headers: string[], columnName: string): number {
  const lower = columnName.toLowerCase();
  const idx = headers.findIndex((h) => h.toLowerCase().includes(lower));
  return idx;
}

/**
 * Parse bank CSV content into normalized BankTransaction objects.
 *
 * Handles German number format (comma decimal, dot thousands),
 * multiple date formats, and various CSV structures.
 *
 * @param csvContent - Raw CSV string
 * @param formatKey - Optional format override (auto-detects if not provided)
 * @returns Array of parsed transactions
 */
export function parseBankCsv(csvContent: string, formatKey?: string): BankTransaction[] {
  const detectedFormat = formatKey ?? detectBankFormat(csvContent);
  const format: BankFormat = BANK_FORMATS[detectedFormat] ?? BANK_FORMATS.generic;

  const lines = csvContent.split('\n').map((l) => l.replace(/\r$/, ''));

  // Find the header line (skip potential metadata lines before headers)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lower = lines[i].toLowerCase();
    if (
      lower.includes('buchungstag') ||
      lower.includes('datum') ||
      lower.includes('betrag') ||
      lower.includes('umsatz')
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx >= lines.length) return [];

  const headers = splitCsvLine(lines[headerIdx], format.delimiter);

  // Find column indices
  const dateIdx = findColumnIndex(headers, format.dateColumn);
  const amountIdx = findColumnIndex(headers, format.amountColumn);
  const purposeIdx = findColumnIndex(headers, format.purposeColumn);
  const senderIdx = findColumnIndex(headers, format.senderRecipientColumn);
  const valueDateIdx = format.valueDateColumn
    ? findColumnIndex(headers, format.valueDateColumn)
    : -1;
  const balanceIdx = format.balanceColumn
    ? findColumnIndex(headers, format.balanceColumn)
    : -1;
  const ibanIdx = format.ibanColumn
    ? findColumnIndex(headers, format.ibanColumn)
    : -1;

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error(
      `Spalten nicht gefunden: ${dateIdx === -1 ? format.dateColumn : ''} ${amountIdx === -1 ? format.amountColumn : ''}`.trim(),
    );
  }

  const transactions: BankTransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = splitCsvLine(line, format.delimiter);
    if (fields.length <= Math.max(dateIdx, amountIdx)) continue;

    const dateStr = fields[dateIdx];
    const amountStr = fields[amountIdx];
    if (!dateStr || !amountStr) continue;

    try {
      const buchungsdatum = parseDate(dateStr, format.dateFormat);
      const betrag = parseGermanNumber(amountStr);

      // Skip rows with zero amount (likely summary rows)
      if (betrag === 0 && !amountStr.includes('0,00') && !amountStr.includes('0.00')) continue;

      const tx: BankTransaction = {
        buchungsdatum,
        betrag,
        verwendungszweck: purposeIdx >= 0 && fields[purposeIdx]
          ? fields[purposeIdx].replace(/^"|"$/g, '')
          : '',
        absenderEmpfaenger: senderIdx >= 0 && fields[senderIdx]
          ? fields[senderIdx].replace(/^"|"$/g, '')
          : undefined,
      };

      if (valueDateIdx >= 0 && fields[valueDateIdx]) {
        tx.wertstellung = parseDate(fields[valueDateIdx], format.dateFormat);
      }
      if (balanceIdx >= 0 && fields[balanceIdx]) {
        tx.saldo = parseGermanNumber(fields[balanceIdx]);
      }
      if (ibanIdx >= 0 && fields[ibanIdx]) {
        tx.iban = fields[ibanIdx].replace(/^"|"$/g, '').replace(/\s/g, '');
      }

      transactions.push(tx);
    } catch {
      // Skip unparseable rows
      continue;
    }
  }

  return transactions;
}
