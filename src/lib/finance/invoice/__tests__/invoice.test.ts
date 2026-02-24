// Invoice System Tests
// Tests for Nummernkreis formatting, status machine transitions, and PDF generation

import { describe, it, expect } from 'vitest';
import { formatInvoiceNumber } from '../nummernkreis';
import {
  isValidTransition,
  VALID_TRANSITIONS,
} from '../status-machine';
import { generateInvoicePdf } from '../pdf-generator';
import type { InvoiceData } from '../types';

// ─── Nummernkreis Tests ────────────────────────────────────────────────────────

describe('Nummernkreis', () => {
  describe('formatInvoiceNumber', () => {
    it('produces formatted numbers matching default pattern RE-YYYY-NNNN', () => {
      const result = formatInvoiceNumber('RE', 2025, 1);
      expect(result).toBe('RE-2025-0001');
    });

    it('pads sequence numbers to 4 digits', () => {
      expect(formatInvoiceNumber('RE', 2025, 1)).toBe('RE-2025-0001');
      expect(formatInvoiceNumber('RE', 2025, 42)).toBe('RE-2025-0042');
      expect(formatInvoiceNumber('RE', 2025, 999)).toBe('RE-2025-0999');
      expect(formatInvoiceNumber('RE', 2025, 9999)).toBe('RE-2025-9999');
    });

    it('handles sequences beyond 4 digits', () => {
      expect(formatInvoiceNumber('RE', 2025, 10000)).toBe('RE-2025-10000');
    });

    it('sequential calls produce incrementing numbers (0001, 0002, 0003)', () => {
      const numbers = [1, 2, 3].map((seq) =>
        formatInvoiceNumber('RE', 2025, seq),
      );
      expect(numbers).toEqual([
        'RE-2025-0001',
        'RE-2025-0002',
        'RE-2025-0003',
      ]);
    });

    it('supports different prefixes', () => {
      expect(formatInvoiceNumber('GS', 2025, 1)).toBe('GS-2025-0001');
    });

    it('supports custom patterns', () => {
      const result = formatInvoiceNumber(
        'INV',
        2025,
        7,
        '{PREFIX}/{YEAR}/{SEQ:6}',
      );
      expect(result).toBe('INV/2025/000007');
    });

    it('supports patterns with different SEQ lengths', () => {
      expect(
        formatInvoiceNumber('RE', 2025, 5, 'RE-{YEAR}-{SEQ:3}'),
      ).toBe('RE-2025-005');
      expect(
        formatInvoiceNumber('RE', 2025, 5, 'RE-{YEAR}-{SEQ:6}'),
      ).toBe('RE-2025-000005');
    });

    it('uses different years for different fiscal periods', () => {
      expect(formatInvoiceNumber('RE', 2024, 1)).toBe('RE-2024-0001');
      expect(formatInvoiceNumber('RE', 2025, 1)).toBe('RE-2025-0001');
      expect(formatInvoiceNumber('RE', 2026, 1)).toBe('RE-2026-0001');
    });
  });
});

// ─── Status Machine Tests ───────────────────────────────────────────────────────

describe('Status Machine', () => {
  describe('isValidTransition', () => {
    it('ENTWURF -> GESTELLT is valid', () => {
      expect(isValidTransition('ENTWURF', 'GESTELLT')).toBe(true);
    });

    it('ENTWURF -> STORNIERT is valid (draft cancel)', () => {
      expect(isValidTransition('ENTWURF', 'STORNIERT')).toBe(true);
    });

    it('GESTELLT -> BEZAHLT is valid', () => {
      expect(isValidTransition('GESTELLT', 'BEZAHLT')).toBe(true);
    });

    it('GESTELLT -> STORNIERT is valid (creates Stornorechnung)', () => {
      expect(isValidTransition('GESTELLT', 'STORNIERT')).toBe(true);
    });

    it('GESTELLT -> MAHNUNG is valid', () => {
      expect(isValidTransition('GESTELLT', 'MAHNUNG')).toBe(true);
    });

    it('MAHNUNG -> BEZAHLT is valid', () => {
      expect(isValidTransition('MAHNUNG', 'BEZAHLT')).toBe(true);
    });

    it('MAHNUNG -> STORNIERT is valid', () => {
      expect(isValidTransition('MAHNUNG', 'STORNIERT')).toBe(true);
    });

    it('BEZAHLT -> ENTWURF is invalid (returns false)', () => {
      expect(isValidTransition('BEZAHLT', 'ENTWURF')).toBe(false);
    });

    it('STORNIERT -> ENTWURF is invalid', () => {
      expect(isValidTransition('STORNIERT', 'ENTWURF')).toBe(false);
    });

    it('BEZAHLT -> GESTELLT is invalid', () => {
      expect(isValidTransition('BEZAHLT', 'GESTELLT')).toBe(false);
    });

    it('ENTWURF -> BEZAHLT is invalid (must go through GESTELLT)', () => {
      expect(isValidTransition('ENTWURF', 'BEZAHLT')).toBe(false);
    });

    it('ENTWURF -> MAHNUNG is invalid', () => {
      expect(isValidTransition('ENTWURF', 'MAHNUNG')).toBe(false);
    });

    it('STORNIERT -> BEZAHLT is invalid (terminal state)', () => {
      expect(isValidTransition('STORNIERT', 'BEZAHLT')).toBe(false);
    });

    it('BEZAHLT has no valid outgoing transitions (terminal)', () => {
      expect(VALID_TRANSITIONS.BEZAHLT.size).toBe(0);
    });

    it('STORNIERT has no valid outgoing transitions (terminal)', () => {
      expect(VALID_TRANSITIONS.STORNIERT.size).toBe(0);
    });

    it('all invalid transitions are rejected comprehensively', () => {
      // Test all impossible transitions
      const allStatuses = [
        'ENTWURF',
        'GESTELLT',
        'BEZAHLT',
        'MAHNUNG',
        'STORNIERT',
      ] as const;

      const invalidTransitions = [
        ['ENTWURF', 'BEZAHLT'],
        ['ENTWURF', 'MAHNUNG'],
        ['GESTELLT', 'ENTWURF'],
        ['BEZAHLT', 'ENTWURF'],
        ['BEZAHLT', 'GESTELLT'],
        ['BEZAHLT', 'STORNIERT'],
        ['BEZAHLT', 'MAHNUNG'],
        ['STORNIERT', 'ENTWURF'],
        ['STORNIERT', 'GESTELLT'],
        ['STORNIERT', 'BEZAHLT'],
        ['STORNIERT', 'MAHNUNG'],
        ['MAHNUNG', 'ENTWURF'],
        ['MAHNUNG', 'GESTELLT'],
      ] as const;

      for (const [from, to] of invalidTransitions) {
        expect(
          isValidTransition(from, to),
          `${from} -> ${to} should be invalid`,
        ).toBe(false);
      }
    });
  });
});

// ─── PDF Generator Tests ────────────────────────────────────────────────────────

describe('PDF Generator', () => {
  const sampleInvoiceData: InvoiceData = {
    rechnungsnummer: 'RE-2025-0001',
    rechnungsdatum: new Date('2025-01-15'),
    faelligAm: new Date('2025-01-29'),
    zahlungszielTage: 14,
    aktenzeichen: '2025/0042',
    mandantName: 'Max Mustermann',
    kanzlei: {
      name: 'Kanzlei Muster & Partner',
      strasse: 'Musterstrasse 1',
      plz: '12345',
      ort: 'Musterstadt',
      telefon: '030/123456',
      email: 'info@kanzlei-muster.de',
      steuernr: '12/345/67890',
      ustIdNr: 'DE123456789',
      bankName: 'Deutsche Bank',
      iban: 'DE89 3704 0044 0532 0130 00',
      bic: 'COBADEFFXXX',
    },
    empfaenger: {
      name: 'Max Mustermann',
      strasse: 'Empfaengerweg 42',
      plz: '54321',
      ort: 'Empfangsstadt',
    },
    positionen: [
      {
        vvNr: '3100',
        beschreibung: 'Verfahrensgebuehr',
        menge: 1,
        einzelpreis: 434.20,
        ustSatz: 19,
        betrag: 434.20,
      },
      {
        vvNr: '3104',
        beschreibung: 'Terminsgebuehr',
        menge: 1,
        einzelpreis: 400.80,
        ustSatz: 19,
        betrag: 400.80,
      },
      {
        vvNr: '7002',
        beschreibung: 'Auslagenpauschale',
        menge: 1,
        einzelpreis: 20.00,
        ustSatz: 19,
        betrag: 20.00,
      },
    ],
    betragNetto: 855.00,
    ustSummary: [
      { satz: 19, bemessungsgrundlage: 855.00, betrag: 162.45 },
    ],
    betragBrutto: 1017.45,
    notizen: 'Gegenstandswert: 5.000,00 EUR',
  };

  it('generates a valid PDF buffer', async () => {
    const pdf = await generateInvoicePdf(sampleInvoiceData);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('PDF starts with valid PDF header', async () => {
    const pdf = await generateInvoicePdf(sampleInvoiceData);
    const header = pdf.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('generates PDF with Storno flag', async () => {
    const stornoData: InvoiceData = {
      ...sampleInvoiceData,
      rechnungsnummer: 'GS-2025-0001',
      isStorno: true,
      stornoVon: 'RE-2025-0001',
    };
    const pdf = await generateInvoicePdf(stornoData);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('generates PDF without optional fields', async () => {
    const minimalData: InvoiceData = {
      rechnungsnummer: 'RE-2025-0002',
      rechnungsdatum: new Date('2025-02-01'),
      zahlungszielTage: 14,
      kanzlei: { name: 'Kanzlei Test' },
      empfaenger: { name: 'Empfaenger Test' },
      positionen: [
        {
          beschreibung: 'Pauschale',
          menge: 1,
          einzelpreis: 100.00,
          ustSatz: 19,
          betrag: 100.00,
        },
      ],
      betragNetto: 100.00,
      ustSummary: [{ satz: 19, bemessungsgrundlage: 100.00, betrag: 19.00 }],
      betragBrutto: 119.00,
    };
    const pdf = await generateInvoicePdf(minimalData);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it('handles invoices with many positions', async () => {
    const manyPositions: InvoiceData = {
      ...sampleInvoiceData,
      positionen: Array.from({ length: 20 }, (_, i) => ({
        vvNr: `${3100 + i}`,
        beschreibung: `Position ${i + 1}`,
        menge: 1,
        einzelpreis: 50.00,
        ustSatz: 19,
        betrag: 50.00,
      })),
      betragNetto: 1000.00,
      ustSummary: [{ satz: 19, bemessungsgrundlage: 1000.00, betrag: 190.00 }],
      betragBrutto: 1190.00,
    };
    const pdf = await generateInvoicePdf(manyPositions);
    expect(pdf).toBeInstanceOf(Buffer);
    // Multi-page invoice should be larger
    expect(pdf.length).toBeGreaterThan(500);
  });
});
