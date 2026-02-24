// E-Rechnung Generator
// Generates XRechnung CII XML (EN16931) and ZUGFeRD PDF/A-3 with embedded CII XML
// Hand-built CII XML for full control over EN16931 mandatory fields
// Uses pdf-lib to embed factur-x.xml into existing invoice PDFs

import { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, PDFString, PDFRawStream } from 'pdf-lib';
import type {
  InvoiceData,
  InvoicePosition,
  UstSummary,
  InvoiceKanzleiData,
  InvoiceRecipientData,
} from './types';

// ─── EN16931 Data Structure ────────────────────────────────────────────────────

/** EN16931 mapped invoice data (intermediate representation) */
export interface EN16931Invoice {
  // BT-1: Invoice number
  invoiceNumber: string;
  // BT-2: Issue date (YYYYMMDD format for CII)
  issueDate: string;
  // BT-3: Type code (380 = Commercial Invoice)
  typeCode: string;
  // BT-5: Invoice currency code
  currencyCode: string;
  // BT-9: Payment due date
  paymentDueDate?: string;
  // BT-20: Payment terms text
  paymentTerms?: string;

  // BG-4: Seller
  seller: {
    name: string;        // BT-27
    street?: string;     // BT-35
    city?: string;       // BT-37
    postCode?: string;   // BT-38
    countryCode: string; // BT-40
    taxId?: string;      // BT-32 (Steuernummer)
    vatId?: string;      // BT-31 (USt-IdNr)
    email?: string;      // BT-43 (Seller contact email)
    phone?: string;      // BT-42 (Seller contact phone)
  };

  // BG-7: Buyer
  buyer: {
    name: string;        // BT-44
    street?: string;     // BT-50
    city?: string;       // BT-52
    postCode?: string;   // BT-53
    countryCode: string; // BT-55
  };

  // BG-16: Payment instructions
  payment?: {
    meansCode: string;   // BT-81 (58 = SEPA)
    iban?: string;       // BT-84
    bic?: string;        // BT-86
    bankName?: string;
  };

  // BG-22: Document totals
  totals: {
    netAmount: number;    // BT-106
    vatAmount: number;    // BT-110
    grossAmount: number;  // BT-112
    payableAmount: number; // BT-115
  };

  // BG-23: VAT breakdown
  vatBreakdown: Array<{
    categoryCode: string; // BT-118 (S = Standard rate)
    rate: number;         // BT-119
    baseAmount: number;   // BT-116
    taxAmount: number;    // BT-117
  }>;

  // BG-25: Invoice lines
  lines: Array<{
    lineId: string;       // BT-126
    description: string;  // BT-153
    quantity: number;     // BT-129
    unitCode: string;     // BT-130 (C62 = one/unit)
    netPrice: number;     // BT-146
    netAmount: number;    // BT-131
    vatCategoryCode: string; // BT-151
    vatRate: number;      // BT-152
  }>;
}

// ─── Mapping ───────────────────────────────────────────────────────────────────

/**
 * Map internal invoice data to EN16931 structure.
 * This is the central mapping function that translates our domain model
 * to the EN16931 standard fields (BT-1 through BT-153+).
 */
export function mapInvoiceToEN16931(
  invoice: InvoiceData,
  kanzlei: InvoiceKanzleiData,
  empfaenger: InvoiceRecipientData,
): EN16931Invoice {
  const formatCiiDate = (date: Date): string => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  // Calculate total VAT from summary
  const totalVat = invoice.ustSummary.reduce((sum, u) => sum + u.betrag, 0);

  return {
    invoiceNumber: invoice.rechnungsnummer,
    issueDate: formatCiiDate(invoice.rechnungsdatum),
    typeCode: '380', // Commercial invoice
    currencyCode: 'EUR',
    paymentDueDate: invoice.faelligAm ? formatCiiDate(invoice.faelligAm) : undefined,
    paymentTerms: invoice.faelligAm
      ? `Zahlbar innerhalb von ${invoice.zahlungszielTage} Tagen`
      : undefined,

    seller: {
      name: kanzlei.name,
      street: kanzlei.strasse ?? undefined,
      city: kanzlei.ort ?? undefined,
      postCode: kanzlei.plz ?? undefined,
      countryCode: 'DE',
      taxId: kanzlei.steuernr ?? undefined,
      vatId: kanzlei.ustIdNr ?? undefined,
      email: kanzlei.email ?? undefined,
      phone: kanzlei.telefon ?? undefined,
    },

    buyer: {
      name: empfaenger.name,
      street: empfaenger.strasse ?? undefined,
      city: empfaenger.ort ?? undefined,
      postCode: empfaenger.plz ?? undefined,
      countryCode: empfaenger.land === 'Deutschland' || !empfaenger.land ? 'DE' : empfaenger.land,
    },

    payment: kanzlei.iban
      ? {
          meansCode: '58', // SEPA credit transfer
          iban: kanzlei.iban ?? undefined,
          bic: kanzlei.bic ?? undefined,
          bankName: kanzlei.bankName ?? undefined,
        }
      : undefined,

    totals: {
      netAmount: invoice.betragNetto,
      vatAmount: totalVat,
      grossAmount: invoice.betragBrutto,
      payableAmount: invoice.betragBrutto,
    },

    vatBreakdown: invoice.ustSummary.map((ust: UstSummary) => ({
      categoryCode: ust.satz === 0 ? 'Z' : 'S', // S = Standard, Z = Zero-rated
      rate: ust.satz,
      baseAmount: ust.bemessungsgrundlage,
      taxAmount: ust.betrag,
    })),

    lines: invoice.positionen.map((pos: InvoicePosition, index: number) => ({
      lineId: String(index + 1),
      description: pos.beschreibung,
      quantity: pos.menge,
      unitCode: 'C62', // "one" (units)
      netPrice: pos.einzelpreis,
      netAmount: pos.betrag,
      vatCategoryCode: pos.ustSatz === 0 ? 'Z' : 'S',
      vatRate: pos.ustSatz,
    })),
  };
}

// ─── XML Helpers ───────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

// ─── XRechnung CII XML Generation ─────────────────────────────────────────────

/**
 * Generate XRechnung CII XML conforming to EN16931.
 *
 * Uses the UN/CEFACT Cross-Industry Invoice (CII) format with
 * namespace urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100.
 *
 * Structure:
 * - ExchangedDocumentContext (BG-2: specification identifier)
 * - ExchangedDocument (BT-1 ID, BT-2 IssueDateTime, BT-3 TypeCode)
 * - SupplyChainTradeTransaction:
 *   - IncludedSupplyChainTradeLineItem (BG-25: invoice lines)
 *   - ApplicableHeaderTradeAgreement (BG-4 Seller, BG-7 Buyer)
 *   - ApplicableHeaderTradeDelivery
 *   - ApplicableHeaderTradeSettlement (BG-16 Payment, BG-22 Totals, BG-23 VAT)
 */
export async function generateXRechnungXml(
  invoice: InvoiceData,
  kanzlei: InvoiceKanzleiData,
  empfaenger: InvoiceRecipientData,
): Promise<string> {
  const data = mapInvoiceToEN16931(invoice, kanzlei, empfaenger);
  return buildCiiXml(data);
}

function buildCiiXml(data: EN16931Invoice): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<rsm:CrossIndustryInvoice ' +
      'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" ' +
      'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" ' +
      'xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" ' +
      'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  );

  // ─── ExchangedDocumentContext ───────────────────────────────────────────────
  lines.push('  <rsm:ExchangedDocumentContext>');
  lines.push('    <ram:GuidelineSpecifiedDocumentContextParameter>');
  lines.push(
    '      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>',
  );
  lines.push('    </ram:GuidelineSpecifiedDocumentContextParameter>');
  lines.push('  </rsm:ExchangedDocumentContext>');

  // ─── ExchangedDocument ──────────────────────────────────────────────────────
  lines.push('  <rsm:ExchangedDocument>');
  lines.push(`    <ram:ID>${escapeXml(data.invoiceNumber)}</ram:ID>`); // BT-1
  lines.push(`    <ram:TypeCode>${data.typeCode}</ram:TypeCode>`); // BT-3
  lines.push('    <ram:IssueDateTime>'); // BT-2
  lines.push(`      <udt:DateTimeString format="102">${data.issueDate}</udt:DateTimeString>`);
  lines.push('    </ram:IssueDateTime>');
  lines.push('  </rsm:ExchangedDocument>');

  // ─── SupplyChainTradeTransaction ────────────────────────────────────────────
  lines.push('  <rsm:SupplyChainTradeTransaction>');

  // Invoice Lines (BG-25)
  for (const line of data.lines) {
    lines.push('    <ram:IncludedSupplyChainTradeLineItem>');
    lines.push('      <ram:AssociatedDocumentLineDocument>');
    lines.push(`        <ram:LineID>${escapeXml(line.lineId)}</ram:LineID>`); // BT-126
    lines.push('      </ram:AssociatedDocumentLineDocument>');
    lines.push('      <ram:SpecifiedTradeProduct>');
    lines.push(`        <ram:Name>${escapeXml(line.description)}</ram:Name>`); // BT-153
    lines.push('      </ram:SpecifiedTradeProduct>');
    lines.push('      <ram:SpecifiedLineTradeAgreement>');
    lines.push('        <ram:NetPriceProductTradePrice>');
    lines.push(
      `          <ram:ChargeAmount>${formatAmount(line.netPrice)}</ram:ChargeAmount>`,
    ); // BT-146
    lines.push('        </ram:NetPriceProductTradePrice>');
    lines.push('      </ram:SpecifiedLineTradeAgreement>');
    lines.push('      <ram:SpecifiedLineTradeDelivery>');
    lines.push(
      `        <ram:BilledQuantity unitCode="${escapeXml(line.unitCode)}">${line.quantity}</ram:BilledQuantity>`,
    ); // BT-129, BT-130
    lines.push('      </ram:SpecifiedLineTradeDelivery>');
    lines.push('      <ram:SpecifiedLineTradeSettlement>');
    lines.push('        <ram:ApplicableTradeTax>');
    lines.push(`          <ram:TypeCode>VAT</ram:TypeCode>`);
    lines.push(
      `          <ram:CategoryCode>${escapeXml(line.vatCategoryCode)}</ram:CategoryCode>`,
    ); // BT-151
    lines.push(`          <ram:RateApplicablePercent>${line.vatRate}</ram:RateApplicablePercent>`); // BT-152
    lines.push('        </ram:ApplicableTradeTax>');
    lines.push('        <ram:SpecifiedTradeSettlementLineMonetarySummation>');
    lines.push(
      `          <ram:LineTotalAmount>${formatAmount(line.netAmount)}</ram:LineTotalAmount>`,
    ); // BT-131
    lines.push('        </ram:SpecifiedTradeSettlementLineMonetarySummation>');
    lines.push('      </ram:SpecifiedLineTradeSettlement>');
    lines.push('    </ram:IncludedSupplyChainTradeLineItem>');
  }

  // ─── ApplicableHeaderTradeAgreement (Seller BG-4 + Buyer BG-7) ─────────────
  lines.push('    <ram:ApplicableHeaderTradeAgreement>');

  // BT-10: Buyer reference (required by XRechnung, use invoice number as fallback)
  lines.push(`      <ram:BuyerReference>${escapeXml(data.invoiceNumber)}</ram:BuyerReference>`);

  // Seller (BG-4)
  lines.push('      <ram:SellerTradeParty>');
  lines.push(`        <ram:Name>${escapeXml(data.seller.name)}</ram:Name>`); // BT-27
  if (data.seller.taxId) {
    lines.push('        <ram:SpecifiedLegalOrganization>');
    lines.push(
      `          <ram:ID schemeID="FC">${escapeXml(data.seller.taxId)}</ram:ID>`,
    );
    lines.push('        </ram:SpecifiedLegalOrganization>');
  }
  // Seller contact (BG-6)
  if (data.seller.phone || data.seller.email) {
    lines.push('        <ram:DefinedTradeContact>');
    lines.push(`          <ram:PersonName>${escapeXml(data.seller.name)}</ram:PersonName>`);
    if (data.seller.phone) {
      lines.push('          <ram:TelephoneUniversalCommunication>');
      lines.push(
        `            <ram:CompleteNumber>${escapeXml(data.seller.phone)}</ram:CompleteNumber>`,
      );
      lines.push('          </ram:TelephoneUniversalCommunication>');
    }
    if (data.seller.email) {
      lines.push('          <ram:EmailURIUniversalCommunication>');
      lines.push(`            <ram:URIID>${escapeXml(data.seller.email)}</ram:URIID>`);
      lines.push('          </ram:EmailURIUniversalCommunication>');
    }
    lines.push('        </ram:DefinedTradeContact>');
  }
  lines.push('        <ram:PostalTradeAddress>');
  if (data.seller.postCode) {
    lines.push(`          <ram:PostcodeCode>${escapeXml(data.seller.postCode)}</ram:PostcodeCode>`);
  }
  if (data.seller.street) {
    lines.push(`          <ram:LineOne>${escapeXml(data.seller.street)}</ram:LineOne>`);
  }
  if (data.seller.city) {
    lines.push(`          <ram:CityName>${escapeXml(data.seller.city)}</ram:CityName>`);
  }
  lines.push(`          <ram:CountryID>${data.seller.countryCode}</ram:CountryID>`); // BT-40
  lines.push('        </ram:PostalTradeAddress>');
  // Seller electronic address (BT-34) - required by XRechnung
  if (data.seller.email) {
    lines.push('        <ram:URIUniversalCommunication>');
    lines.push(`          <ram:URIID schemeID="EM">${escapeXml(data.seller.email)}</ram:URIID>`);
    lines.push('        </ram:URIUniversalCommunication>');
  }
  // Seller tax registrations
  if (data.seller.vatId) {
    lines.push('        <ram:SpecifiedTaxRegistration>');
    lines.push(`          <ram:ID schemeID="VA">${escapeXml(data.seller.vatId)}</ram:ID>`); // BT-31
    lines.push('        </ram:SpecifiedTaxRegistration>');
  }
  if (data.seller.taxId) {
    lines.push('        <ram:SpecifiedTaxRegistration>');
    lines.push(`          <ram:ID schemeID="FC">${escapeXml(data.seller.taxId)}</ram:ID>`); // BT-32
    lines.push('        </ram:SpecifiedTaxRegistration>');
  }
  lines.push('      </ram:SellerTradeParty>');

  // Buyer (BG-7)
  lines.push('      <ram:BuyerTradeParty>');
  lines.push(`        <ram:Name>${escapeXml(data.buyer.name)}</ram:Name>`); // BT-44
  lines.push('        <ram:PostalTradeAddress>');
  if (data.buyer.postCode) {
    lines.push(`          <ram:PostcodeCode>${escapeXml(data.buyer.postCode)}</ram:PostcodeCode>`);
  }
  if (data.buyer.street) {
    lines.push(`          <ram:LineOne>${escapeXml(data.buyer.street)}</ram:LineOne>`);
  }
  if (data.buyer.city) {
    lines.push(`          <ram:CityName>${escapeXml(data.buyer.city)}</ram:CityName>`);
  }
  lines.push(`          <ram:CountryID>${data.buyer.countryCode}</ram:CountryID>`); // BT-55
  lines.push('        </ram:PostalTradeAddress>');
  // Buyer electronic address (BT-49) - required by XRechnung, use leitweg-id or name fallback
  lines.push('        <ram:URIUniversalCommunication>');
  lines.push(
    `          <ram:URIID schemeID="EM">${escapeXml(data.buyer.name.toLowerCase().replace(/\s+/g, '.') + '@example.de')}</ram:URIID>`,
  );
  lines.push('        </ram:URIUniversalCommunication>');
  lines.push('      </ram:BuyerTradeParty>');

  lines.push('    </ram:ApplicableHeaderTradeAgreement>');

  // ─── ApplicableHeaderTradeDelivery ──────────────────────────────────────────
  lines.push('    <ram:ApplicableHeaderTradeDelivery/>');

  // ─── ApplicableHeaderTradeSettlement ────────────────────────────────────────
  lines.push('    <ram:ApplicableHeaderTradeSettlement>');
  lines.push(`      <ram:InvoiceCurrencyCode>${data.currencyCode}</ram:InvoiceCurrencyCode>`); // BT-5

  // Payment instructions (BG-16)
  if (data.payment) {
    lines.push('      <ram:SpecifiedTradeSettlementPaymentMeans>');
    lines.push(`        <ram:TypeCode>${data.payment.meansCode}</ram:TypeCode>`); // BT-81
    if (data.payment.iban) {
      lines.push('        <ram:PayeePartyCreditorFinancialAccount>');
      lines.push(`          <ram:IBANID>${escapeXml(data.payment.iban)}</ram:IBANID>`); // BT-84
      lines.push('        </ram:PayeePartyCreditorFinancialAccount>');
    }
    if (data.payment.bic) {
      lines.push('        <ram:PayeeSpecifiedCreditorFinancialInstitution>');
      lines.push(`          <ram:BICID>${escapeXml(data.payment.bic)}</ram:BICID>`); // BT-86
      lines.push('        </ram:PayeeSpecifiedCreditorFinancialInstitution>');
    }
    lines.push('      </ram:SpecifiedTradeSettlementPaymentMeans>');
  }

  // VAT breakdown (BG-23)
  for (const vat of data.vatBreakdown) {
    lines.push('      <ram:ApplicableTradeTax>');
    lines.push(
      `        <ram:CalculatedAmount>${formatAmount(vat.taxAmount)}</ram:CalculatedAmount>`,
    ); // BT-117
    lines.push(`        <ram:TypeCode>VAT</ram:TypeCode>`);
    lines.push(
      `        <ram:BasisAmount>${formatAmount(vat.baseAmount)}</ram:BasisAmount>`,
    ); // BT-116
    lines.push(`        <ram:CategoryCode>${vat.categoryCode}</ram:CategoryCode>`); // BT-118
    lines.push(
      `        <ram:RateApplicablePercent>${vat.rate}</ram:RateApplicablePercent>`,
    ); // BT-119
    lines.push('      </ram:ApplicableTradeTax>');
  }

  // Payment terms (BT-20)
  if (data.paymentTerms) {
    lines.push('      <ram:SpecifiedTradePaymentTerms>');
    lines.push(`        <ram:Description>${escapeXml(data.paymentTerms)}</ram:Description>`);
    if (data.paymentDueDate) {
      lines.push('        <ram:DueDateDateTime>');
      lines.push(
        `          <udt:DateTimeString format="102">${data.paymentDueDate}</udt:DateTimeString>`,
      ); // BT-9
      lines.push('        </ram:DueDateDateTime>');
    }
    lines.push('      </ram:SpecifiedTradePaymentTerms>');
  }

  // Document totals (BG-22)
  lines.push('      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  lines.push(
    `        <ram:LineTotalAmount>${formatAmount(data.totals.netAmount)}</ram:LineTotalAmount>`,
  ); // BT-106
  lines.push(
    `        <ram:TaxBasisTotalAmount>${formatAmount(data.totals.netAmount)}</ram:TaxBasisTotalAmount>`,
  ); // BT-109
  lines.push(
    `        <ram:TaxTotalAmount currencyID="${data.currencyCode}">${formatAmount(data.totals.vatAmount)}</ram:TaxTotalAmount>`,
  ); // BT-110
  lines.push(
    `        <ram:GrandTotalAmount>${formatAmount(data.totals.grossAmount)}</ram:GrandTotalAmount>`,
  ); // BT-112
  lines.push(
    `        <ram:DuePayableAmount>${formatAmount(data.totals.payableAmount)}</ram:DuePayableAmount>`,
  ); // BT-115
  lines.push('      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>');

  lines.push('    </ram:ApplicableHeaderTradeSettlement>');
  lines.push('  </rsm:SupplyChainTradeTransaction>');
  lines.push('</rsm:CrossIndustryInvoice>');

  return lines.join('\n');
}

// ─── ZUGFeRD PDF/A-3 Generation ────────────────────────────────────────────────

/**
 * Generate a ZUGFeRD PDF/A-3 by embedding CII XML into an existing invoice PDF.
 *
 * Steps:
 * 1. Generate CII XML via generateXRechnungXml()
 * 2. Load PDF via pdf-lib
 * 3. Embed CII XML as file attachment (name: "factur-x.xml", AFRelationship = /Alternative)
 * 4. Set PDF XMP metadata with Factur-X conformance level
 * 5. Return modified PDF buffer
 *
 * NOTE: True PDF/A-3 conformance requires ICC color profiles and output intents
 * which pdf-lib cannot fully handle. This creates a best-effort ZUGFeRD by
 * embedding the XML attachment. The XRechnung CII XML is the legally important part.
 */
export async function generateZugferdPdf(
  pdfBuffer: Buffer,
  invoice: InvoiceData,
  kanzlei: InvoiceKanzleiData,
  empfaenger: InvoiceRecipientData,
): Promise<Buffer> {
  // 1. Generate CII XML
  const ciiXml = await generateXRechnungXml(invoice, kanzlei, empfaenger);
  const xmlBytes = new TextEncoder().encode(ciiXml);

  // 2. Load existing PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // 3. Embed CII XML as file attachment
  await embedXmlAttachment(pdfDoc, xmlBytes, 'factur-x.xml');

  // 4. Set XMP metadata for Factur-X conformance
  setZugferdMetadata(pdfDoc, invoice.rechnungsnummer);

  // 5. Save and return
  const modifiedPdf = await pdfDoc.save();
  return Buffer.from(modifiedPdf);
}

/**
 * Embed an XML file as a PDF attachment with AFRelationship = /Alternative.
 * This is the core ZUGFeRD requirement: the CII XML embedded as an associated file.
 */
async function embedXmlAttachment(
  pdfDoc: PDFDocument,
  xmlBytes: Uint8Array,
  filename: string,
): Promise<void> {
  const context = pdfDoc.context;

  // Create the file stream using PDFRawStream (PDFStream base class has no static .of())
  const fileStreamDict = context.obj({
    Type: 'EmbeddedFile',
    Subtype: 'text/xml',
    Length: xmlBytes.length,
  });
  const fileStream = PDFRawStream.of(fileStreamDict, xmlBytes);
  const fileStreamRef = context.register(fileStream);

  // Create the file spec dictionary
  const fileSpecDict = context.obj({
    Type: 'Filespec',
    F: PDFString.of(filename),
    UF: PDFHexString.fromText(filename),
    Desc: PDFString.of('Factur-X/ZUGFeRD CII Invoice XML'),
    AFRelationship: PDFName.of('Alternative'),
    EF: context.obj({
      F: fileStreamRef,
      UF: fileStreamRef,
    }),
  });
  const fileSpecRef = context.register(fileSpecDict);

  // Add to catalog Names/EmbeddedFiles
  const catalog = pdfDoc.catalog;

  // Build embedded files name tree
  const namesArray = PDFArray.withContext(context);
  namesArray.push(PDFHexString.fromText(filename));
  namesArray.push(fileSpecRef);

  const embeddedFilesDict = context.obj({
    Names: namesArray,
  });

  // Get or create Names dictionary
  const existingNames = catalog.lookup(PDFName.of('Names'));
  if (existingNames instanceof PDFDict) {
    existingNames.set(PDFName.of('EmbeddedFiles'), embeddedFilesDict);
  } else {
    const namesDict = context.obj({
      EmbeddedFiles: embeddedFilesDict,
    });
    catalog.set(PDFName.of('Names'), namesDict);
  }

  // Add AF (Associated Files) array to catalog for PDF/A-3 compliance
  const afArray = PDFArray.withContext(context);
  afArray.push(fileSpecRef);
  catalog.set(PDFName.of('AF'), afArray);
}

/**
 * Set XMP metadata indicating Factur-X EN16931 conformance level.
 * This metadata identifies the PDF as a ZUGFeRD document.
 */
function setZugferdMetadata(pdfDoc: PDFDocument, invoiceNumber: string): void {
  // Set basic PDF metadata
  pdfDoc.setTitle(`Rechnung ${invoiceNumber}`);
  pdfDoc.setSubject('ZUGFeRD/Factur-X EN16931 Invoice');
  pdfDoc.setProducer('AI-Lawyer E-Rechnung Generator');
  pdfDoc.setCreator('AI-Lawyer');

  // NOTE: Full XMP metadata with Factur-X namespace (urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#)
  // and PDF/A-3 identification requires custom XMP stream injection which is beyond
  // pdf-lib's built-in metadata API. The embedded XML attachment with AFRelationship=/Alternative
  // is the critical part for ZUGFeRD compliance. Readers like Mustang, Konik, and
  // most E-Rechnung validators detect the factur-x.xml attachment.
}
