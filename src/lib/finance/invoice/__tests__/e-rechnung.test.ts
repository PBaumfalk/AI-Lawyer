// E-Rechnung Tests
// Validates XRechnung CII XML structure, EN16931 field mapping, and ZUGFeRD PDF embedding

import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import {
  mapInvoiceToEN16931,
  generateXRechnungXml,
  generateZugferdPdf,
} from '../e-rechnung';
import { generateInvoicePdf } from '../pdf-generator';
import type {
  InvoiceData,
  InvoiceKanzleiData,
  InvoiceRecipientData,
} from '../types';

// ─── Test Data ─────────────────────────────────────────────────────────────────

const sampleKanzlei: InvoiceKanzleiData = {
  name: 'Kanzlei Muster & Partner',
  strasse: 'Musterstrasse 1',
  plz: '12345',
  ort: 'Musterstadt',
  telefon: '030/123456',
  email: 'info@kanzlei-muster.de',
  steuernr: '12/345/67890',
  ustIdNr: 'DE123456789',
  bankName: 'Deutsche Bank',
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
};

const sampleEmpfaenger: InvoiceRecipientData = {
  name: 'Max Mustermann',
  strasse: 'Empfaengerweg 42',
  plz: '54321',
  ort: 'Empfangsstadt',
};

const sampleInvoice: InvoiceData = {
  rechnungsnummer: 'RE-2025-0001',
  rechnungsdatum: new Date('2025-01-15'),
  faelligAm: new Date('2025-01-29'),
  zahlungszielTage: 14,
  aktenzeichen: '2025/0042',
  mandantName: 'Max Mustermann',
  kanzlei: sampleKanzlei,
  empfaenger: sampleEmpfaenger,
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
  ustSummary: [{ satz: 19, bemessungsgrundlage: 855.00, betrag: 162.45 }],
  betragBrutto: 1017.45,
  notizen: 'Gegenstandswert: 5.000,00 EUR',
};

// ─── mapInvoiceToEN16931 Tests ─────────────────────────────────────────────────

describe('mapInvoiceToEN16931', () => {
  it('maps BT-1 invoice number correctly', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.invoiceNumber).toBe('RE-2025-0001');
  });

  it('maps BT-2 issue date in YYYYMMDD format', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.issueDate).toBe('20250115');
  });

  it('maps BT-3 type code to 380 (commercial invoice)', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.typeCode).toBe('380');
  });

  it('maps BT-5 currency to EUR', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.currencyCode).toBe('EUR');
  });

  it('maps BT-9 payment due date', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.paymentDueDate).toBe('20250129');
  });

  it('maps BT-20 payment terms text', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.paymentTerms).toBe('Zahlbar innerhalb von 14 Tagen');
  });

  it('maps BG-4 seller with all mandatory fields', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.seller.name).toBe('Kanzlei Muster & Partner');
    expect(result.seller.street).toBe('Musterstrasse 1');
    expect(result.seller.city).toBe('Musterstadt');
    expect(result.seller.postCode).toBe('12345');
    expect(result.seller.countryCode).toBe('DE');
    expect(result.seller.taxId).toBe('12/345/67890');
    expect(result.seller.vatId).toBe('DE123456789');
  });

  it('maps BG-7 buyer with all mandatory fields', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.buyer.name).toBe('Max Mustermann');
    expect(result.buyer.street).toBe('Empfaengerweg 42');
    expect(result.buyer.city).toBe('Empfangsstadt');
    expect(result.buyer.postCode).toBe('54321');
    expect(result.buyer.countryCode).toBe('DE');
  });

  it('maps BG-16 payment instructions for SEPA', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.payment).toBeDefined();
    expect(result.payment?.meansCode).toBe('58');
    expect(result.payment?.iban).toBe('DE89370400440532013000');
    expect(result.payment?.bic).toBe('COBADEFFXXX');
  });

  it('maps BG-22 document totals correctly', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.totals.netAmount).toBe(855.00);
    expect(result.totals.vatAmount).toBe(162.45);
    expect(result.totals.grossAmount).toBe(1017.45);
    expect(result.totals.payableAmount).toBe(1017.45);
  });

  it('maps BG-23 VAT breakdown with correct category', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.vatBreakdown).toHaveLength(1);
    expect(result.vatBreakdown[0].categoryCode).toBe('S');
    expect(result.vatBreakdown[0].rate).toBe(19);
    expect(result.vatBreakdown[0].baseAmount).toBe(855.00);
    expect(result.vatBreakdown[0].taxAmount).toBe(162.45);
  });

  it('maps BG-25 invoice lines with all fields', () => {
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].lineId).toBe('1');
    expect(result.lines[0].description).toBe('Verfahrensgebuehr');
    expect(result.lines[0].quantity).toBe(1);
    expect(result.lines[0].unitCode).toBe('C62');
    expect(result.lines[0].netPrice).toBe(434.20);
    expect(result.lines[0].netAmount).toBe(434.20);
    expect(result.lines[0].vatCategoryCode).toBe('S');
    expect(result.lines[0].vatRate).toBe(19);
  });

  it('handles zero-rated VAT with category Z', () => {
    const zeroRateInvoice: InvoiceData = {
      ...sampleInvoice,
      positionen: [
        {
          beschreibung: 'Steuerfreie Leistung',
          menge: 1,
          einzelpreis: 100,
          ustSatz: 0,
          betrag: 100,
        },
      ],
      ustSummary: [{ satz: 0, bemessungsgrundlage: 100, betrag: 0 }],
    };
    const result = mapInvoiceToEN16931(zeroRateInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(result.vatBreakdown[0].categoryCode).toBe('Z');
    expect(result.lines[0].vatCategoryCode).toBe('Z');
  });

  it('defaults buyer country to DE when land is not set', () => {
    const empOhne = { ...sampleEmpfaenger, land: undefined };
    const result = mapInvoiceToEN16931(sampleInvoice, sampleKanzlei, empOhne);
    expect(result.buyer.countryCode).toBe('DE');
  });
});

// ─── generateXRechnungXml Tests ────────────────────────────────────────────────

describe('generateXRechnungXml', () => {
  it('produces valid XML with CII namespace', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100');
  });

  it('contains XML declaration', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  });

  it('contains ExchangedDocument with TypeCode 380', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
  });

  it('contains BT-1 invoice number in ExchangedDocument', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:ID>RE-2025-0001</ram:ID>');
  });

  it('contains BT-2 issue date in format 102', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<udt:DateTimeString format="102">20250115</udt:DateTimeString>');
  });

  it('contains BT-5 currency EUR', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>');
  });

  it('contains seller (BG-4) block with name and address', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:SellerTradeParty>');
    expect(xml).toContain('<ram:Name>Kanzlei Muster &amp; Partner</ram:Name>');
    expect(xml).toContain('<ram:CountryID>DE</ram:CountryID>');
  });

  it('contains buyer (BG-7) block with name and address', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:BuyerTradeParty>');
    expect(xml).toContain('<ram:Name>Max Mustermann</ram:Name>');
  });

  it('contains at least one invoice line (BG-25)', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:IncludedSupplyChainTradeLineItem>');
    expect(xml).toContain('<ram:LineID>1</ram:LineID>');
    expect(xml).toContain('<ram:Name>Verfahrensgebuehr</ram:Name>');
  });

  it('contains VAT breakdown (BG-23) with correct rate', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    // BG-23 in header settlement
    expect(xml).toContain('<ram:ApplicableTradeTax>');
    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    expect(xml).toContain('<ram:RateApplicablePercent>19</ram:RateApplicablePercent>');
    expect(xml).toContain('<ram:BasisAmount>855.00</ram:BasisAmount>');
    expect(xml).toContain('<ram:CalculatedAmount>162.45</ram:CalculatedAmount>');
  });

  it('contains document totals (BG-22)', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:LineTotalAmount>855.00</ram:LineTotalAmount>');
    expect(xml).toContain('<ram:GrandTotalAmount>1017.45</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:DuePayableAmount>1017.45</ram:DuePayableAmount>');
  });

  it('contains SEPA payment instructions', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:TypeCode>58</ram:TypeCode>');
    expect(xml).toContain('<ram:IBANID>DE89370400440532013000</ram:IBANID>');
    expect(xml).toContain('<ram:BICID>COBADEFFXXX</ram:BICID>');
  });

  it('contains seller tax registrations (BT-31, BT-32)', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="FC">12/345/67890</ram:ID>');
  });

  it('contains payment terms and due date', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('Zahlbar innerhalb von 14 Tagen');
    expect(xml).toContain('20250129');
  });

  it('contains XRechnung specification identifier', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0');
  });

  it('properly escapes XML special characters', async () => {
    const specialKanzlei = {
      ...sampleKanzlei,
      name: 'Kanzlei M<ller & S"hne',
    };
    const xml = await generateXRechnungXml(sampleInvoice, specialKanzlei, sampleEmpfaenger);
    expect(xml).toContain('Kanzlei M&lt;ller &amp; S&quot;hne');
    expect(xml).not.toContain('Kanzlei M<ller');
  });

  it('generates all three line items', async () => {
    const xml = await generateXRechnungXml(sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(xml).toContain('<ram:LineID>1</ram:LineID>');
    expect(xml).toContain('<ram:LineID>2</ram:LineID>');
    expect(xml).toContain('<ram:LineID>3</ram:LineID>');
  });
});

// ─── generateZugferdPdf Tests ──────────────────────────────────────────────────

describe('generateZugferdPdf', () => {
  it('returns a valid PDF buffer with embedded XML', async () => {
    const basePdf = await generateInvoicePdf(sampleInvoice);
    const zugferdPdf = await generateZugferdPdf(basePdf, sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    expect(zugferdPdf).toBeInstanceOf(Buffer);
    expect(zugferdPdf.length).toBeGreaterThan(basePdf.length);
  });

  it('PDF starts with valid header', async () => {
    const basePdf = await generateInvoicePdf(sampleInvoice);
    const zugferdPdf = await generateZugferdPdf(basePdf, sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    const header = zugferdPdf.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('embedded PDF has EmbeddedFiles name tree in catalog', async () => {
    const basePdf = await generateInvoicePdf(sampleInvoice);
    const zugferdPdf = await generateZugferdPdf(basePdf, sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    // Reload with pdf-lib to inspect structure
    const reloaded = await PDFDocument.load(zugferdPdf);
    const catalog = reloaded.catalog;
    // Check that Names dictionary exists with EmbeddedFiles
    const names = catalog.lookup(PDFName.of('Names'));
    expect(names).toBeInstanceOf(PDFDict);
    const embeddedFiles = (names as PDFDict).lookup(PDFName.of('EmbeddedFiles'));
    expect(embeddedFiles).toBeDefined();
  });

  it('embedded PDF has AF (Associated Files) array in catalog', async () => {
    const basePdf = await generateInvoicePdf(sampleInvoice);
    const zugferdPdf = await generateZugferdPdf(basePdf, sampleInvoice, sampleKanzlei, sampleEmpfaenger);
    // Reload with pdf-lib to inspect structure
    const reloaded = await PDFDocument.load(zugferdPdf);
    const catalog = reloaded.catalog;
    // Check that AF array exists
    const af = catalog.lookup(PDFName.of('AF'));
    expect(af).toBeDefined();
  });
});
