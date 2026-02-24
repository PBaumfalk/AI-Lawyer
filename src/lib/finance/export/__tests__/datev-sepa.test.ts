// DATEV + SEPA Export Tests
// Tests for DATEV Buchungsstapel CSV generation and SEPA pain.001/008 XML

import { describe, it, expect } from 'vitest';
import {
  formatGermanNumber,
  formatDatevDate,
  getBuSchluessel,
  getKontenrahmen,
  generateExtfHeader,
  generateColumnHeaders,
  formatBookingRow,
  mapBuchungstypToDatev,
} from '../datev';
import { generateSepaCreditTransfer, generateSepaDirectDebit } from '../sepa';
import { SKR03_MAPPING, SKR04_MAPPING } from '../types';
import type { SepaDebtor, SepaPayment, SepaCreditor, SepaMandate, DatevBooking } from '../types';
import { BuchungsTyp } from '@prisma/client';

// ─── DATEV Tests ────────────────────────────────────────────────────────────

describe('DATEV Export', () => {
  describe('formatGermanNumber', () => {
    it('formats simple amounts with comma decimal', () => {
      expect(formatGermanNumber(100.50)).toBe('100,50');
    });

    it('formats amounts with thousand separators', () => {
      expect(formatGermanNumber(1234.56)).toBe('1.234,56');
    });

    it('formats large amounts correctly', () => {
      expect(formatGermanNumber(12345678.90)).toBe('12.345.678,90');
    });

    it('handles zero', () => {
      expect(formatGermanNumber(0)).toBe('0,00');
    });

    it('handles negative amounts as absolute value', () => {
      expect(formatGermanNumber(-500.25)).toBe('500,25');
    });
  });

  describe('formatDatevDate', () => {
    it('formats date as DDMM', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatDatevDate(date)).toBe('1501');
    });

    it('pads single-digit day and month', () => {
      const date = new Date(2025, 2, 5); // March 5, 2025
      expect(formatDatevDate(date)).toBe('0503');
    });

    it('formats December 31 correctly', () => {
      const date = new Date(2025, 11, 31);
      expect(formatDatevDate(date)).toBe('3112');
    });
  });

  describe('getBuSchluessel', () => {
    it('returns 9 for 19% USt', () => {
      expect(getBuSchluessel(19)).toBe('9');
    });

    it('returns 8 for 7% USt', () => {
      expect(getBuSchluessel(7)).toBe('8');
    });

    it('returns empty string for other rates', () => {
      expect(getBuSchluessel(0)).toBe('');
      expect(getBuSchluessel(5)).toBe('');
      expect(getBuSchluessel(undefined)).toBe('');
    });
  });

  describe('EXTF_ header', () => {
    it('starts with "EXTF";700;21', () => {
      const header = generateExtfHeader({
        periodeStart: new Date(2025, 0, 1),
        periodeEnd: new Date(2025, 0, 31),
        beraternummer: 1001,
        mandantennummer: 1,
      });
      expect(header).toMatch(/^"EXTF";700;21/);
    });

    it('uses semicolon delimiter', () => {
      const header = generateExtfHeader({
        periodeStart: new Date(2025, 0, 1),
        periodeEnd: new Date(2025, 0, 31),
        beraternummer: 1001,
        mandantennummer: 1,
      });
      const parts = header.split(';');
      expect(parts.length).toBeGreaterThan(10);
    });

    it('includes Beraternummer and Mandantennummer', () => {
      const header = generateExtfHeader({
        periodeStart: new Date(2025, 0, 1),
        periodeEnd: new Date(2025, 0, 31),
        beraternummer: 42,
        mandantennummer: 99,
      });
      expect(header).toContain(';42;');
      expect(header).toContain(';99;');
    });

    it('contains Buchungsstapel format name', () => {
      const header = generateExtfHeader({
        periodeStart: new Date(2025, 0, 1),
        periodeEnd: new Date(2025, 0, 31),
        beraternummer: 1001,
        mandantennummer: 1,
      });
      expect(header).toContain('"Buchungsstapel"');
    });
  });

  describe('Column headers', () => {
    it('contains key column names', () => {
      const headers = generateColumnHeaders();
      expect(headers).toContain('Umsatz');
      expect(headers).toContain('Soll/Haben-Kennzeichen');
      expect(headers).toContain('Konto');
      expect(headers).toContain('Gegenkonto');
      expect(headers).toContain('BU-Schluessel');
      expect(headers).toContain('Belegdatum');
      expect(headers).toContain('Buchungstext');
    });
  });

  describe('Booking row formatting', () => {
    it('formats a complete booking row with semicolons', () => {
      const booking: DatevBooking = {
        amount: '1.234,56',
        debitCredit: 'S',
        currency: 'EUR',
        account: '1200',
        contraAccount: '8400',
        buKey: '9',
        date: '1501',
        reference1: 'RE-2025-0001',
        text: 'Honorar Mandant Mueller',
        costCenter1: 'KST001',
      };
      const row = formatBookingRow(booking);
      expect(row).toContain('1.234,56');
      expect(row).toContain(';S;');
      expect(row).toContain(';EUR;');
      expect(row).toContain(';1200;');
      expect(row).toContain(';8400;');
      expect(row).toContain(';9;');
      expect(row).toContain(';1501;');
      expect(row).toContain('RE-2025-0001');
      expect(row).toContain('"Honorar Mandant Mueller"');
    });

    it('truncates Buchungstext to 60 chars', () => {
      const longText = 'A'.repeat(100);
      const booking: DatevBooking = {
        amount: '100,00',
        debitCredit: 'H',
        currency: 'EUR',
        account: '4900',
        contraAccount: '1200',
        date: '0103',
        text: longText,
      };
      const row = formatBookingRow(booking);
      // Expect the quoted text to contain exactly 60 chars
      expect(row).toContain(`"${'A'.repeat(60)}"`);
    });
  });

  describe('SKR03 vs SKR04 mapping', () => {
    it('returns correct SKR03 Sachkonten', () => {
      const mapping = getKontenrahmen('SKR03');
      expect(mapping.mandantengelder).toBe('1590');
      expect(mapping.fremdgeld).toBe('1599');
      expect(mapping.honorar).toBe('8400');
      expect(mapping.auslagen).toBe('4900');
    });

    it('returns correct SKR04 Sachkonten', () => {
      const mapping = getKontenrahmen('SKR04');
      expect(mapping.mandantengelder).toBe('3590');
      expect(mapping.fremdgeld).toBe('3599');
      expect(mapping.honorar).toBe('4400');
      expect(mapping.auslagen).toBe('6300');
    });
  });

  describe('BuchungsTyp to DATEV mapping', () => {
    it('maps EINNAHME to Soll with bank/honorar accounts (SKR03)', () => {
      const result = mapBuchungstypToDatev(BuchungsTyp.EINNAHME, 100, SKR03_MAPPING);
      expect(result.debitCredit).toBe('S');
      expect(result.account).toBe('1200');
      expect(result.contraAccount).toBe('8400');
    });

    it('maps AUSGABE (negative) to Soll with auslagen/bank accounts (SKR03)', () => {
      const result = mapBuchungstypToDatev(BuchungsTyp.AUSGABE, -50, SKR03_MAPPING);
      expect(result.debitCredit).toBe('S');
      expect(result.account).toBe('4900');
      expect(result.contraAccount).toBe('1200');
    });

    it('maps FREMDGELD to Soll with bank/fremdgeld accounts (SKR03)', () => {
      const result = mapBuchungstypToDatev(BuchungsTyp.FREMDGELD, 2000, SKR03_MAPPING);
      expect(result.debitCredit).toBe('S');
      expect(result.account).toBe('1200');
      expect(result.contraAccount).toBe('1599');
    });

    it('uses custom sachkonto when provided', () => {
      const result = mapBuchungstypToDatev(BuchungsTyp.EINNAHME, 100, SKR03_MAPPING, '9999');
      expect(result.account).toBe('9999');
    });
  });
});

// ─── SEPA Tests ─────────────────────────────────────────────────────────────

describe('SEPA Export', () => {
  const testDebtor: SepaDebtor = {
    name: 'Kanzlei Mueller und Partner',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
  };

  const testPayments: SepaPayment[] = [
    {
      creditorName: 'Max Mustermann',
      creditorIban: 'DE27100777770209299700',
      amount: 1500.00,
      reference: 'FG-2025-001',
      purpose: 'Fremdgeld Weiterleitung Akte 1/25',
    },
  ];

  const testCreditor: SepaCreditor = {
    name: 'Kanzlei Mueller und Partner',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    creditorId: 'DE98ZZZ09999999999',
  };

  const testMandates: SepaMandate[] = [
    {
      mandateId: 'M-2025-001',
      creditorId: 'DE98ZZZ09999999999',
      debtorName: 'Erika Musterfrau',
      debtorIban: 'DE27100777770209299700',
      signatureDate: new Date(2025, 0, 15),
      amount: 500.00,
      reference: 'H-2025-001',
      purpose: 'Honorar Monat Januar 2025',
    },
  ];

  describe('pain.001 (Credit Transfer)', () => {
    it('generates valid XML string', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toBeTruthy();
      expect(typeof xml).toBe('string');
    });

    it('contains CstmrCdtTrfInitn namespace element', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toContain('CstmrCdtTrfInitn');
    });

    it('contains pain.001 namespace', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toContain('pain.001');
    });

    it('contains debtor IBAN', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toContain('DE89370400440532013000');
    });

    it('contains creditor name and IBAN', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toContain('Max Mustermann');
      expect(xml).toContain('DE27100777770209299700');
    });

    it('contains payment amount', () => {
      const xml = generateSepaCreditTransfer(testDebtor, testPayments, new Date(2025, 1, 1));
      expect(xml).toContain('1500');
    });

    it('throws error for empty payments array', () => {
      expect(() => {
        generateSepaCreditTransfer(testDebtor, [], new Date(2025, 1, 1));
      }).toThrow('Mindestens eine Zahlung erforderlich');
    });
  });

  describe('pain.008 (Direct Debit)', () => {
    it('generates valid XML string', () => {
      const xml = generateSepaDirectDebit(testCreditor, testMandates, new Date(2025, 1, 15));
      expect(xml).toBeTruthy();
      expect(typeof xml).toBe('string');
    });

    it('contains CstmrDrctDbtInitn namespace element', () => {
      const xml = generateSepaDirectDebit(testCreditor, testMandates, new Date(2025, 1, 15));
      expect(xml).toContain('CstmrDrctDbtInitn');
    });

    it('contains pain.008 namespace', () => {
      const xml = generateSepaDirectDebit(testCreditor, testMandates, new Date(2025, 1, 15));
      expect(xml).toContain('pain.008');
    });

    it('contains debtor name', () => {
      const xml = generateSepaDirectDebit(testCreditor, testMandates, new Date(2025, 1, 15));
      expect(xml).toContain('Erika Musterfrau');
    });

    it('contains mandate information', () => {
      const xml = generateSepaDirectDebit(testCreditor, testMandates, new Date(2025, 1, 15));
      expect(xml).toContain('M-2025-001');
    });

    it('throws error for empty mandates array', () => {
      expect(() => {
        generateSepaDirectDebit(testCreditor, [], new Date(2025, 1, 15));
      }).toThrow('Mindestens ein Mandat erforderlich');
    });
  });
});
