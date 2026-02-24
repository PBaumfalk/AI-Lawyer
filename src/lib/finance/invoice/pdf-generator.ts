// Invoice PDF Generator
// Generates SS 14 UStG compliant invoice PDFs with firm Briefkopf
// Uses pdf-lib for server-side PDF generation without native dependencies

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { InvoiceData, InvoicePosition, UstSummary } from './types';

// A4 dimensions in PDF points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_LEFT = 56.69;  // ~20mm
const MARGIN_RIGHT = 56.69;
const MARGIN_TOP = 56.69;
const MARGIN_BOTTOM = 56.69;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colors
const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.3, 0.3, 0.3);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
const BRAND_BLUE = rgb(0.176, 0.333, 0.682);  // approx oklch(45% 0.2 260)

// Font sizes
const FONT_TITLE = 16;
const FONT_HEADING = 11;
const FONT_BODY = 9;
const FONT_SMALL = 7.5;

const LINE_HEIGHT = 14;
const TABLE_ROW_HEIGHT = 16;

/**
 * Generate a professional invoice PDF with Briefkopf.
 *
 * Layout:
 * 1. Header: Kanzlei name + address (top-right block)
 * 2. Recipient: Name + address (left side, DIN 5008 window position)
 * 3. Invoice header: Rechnungsnummer, Datum, Aktenzeichen, Mandant
 * 4. Position table: Nr, VV-Nr, Beschreibung, Menge, Einzelpreis, USt-Satz, Betrag
 * 5. Subtotals: Netto, per USt-Satz breakdown, Brutto
 * 6. Footer: SS 14 UStG info (Steuernummer, USt-IdNr), Bankverbindung, Zahlungsziel
 *
 * @param data - Complete invoice data
 * @returns PDF as Buffer
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN_TOP;

  // Helper: draw text
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options?: {
      font?: typeof helvetica;
      size?: number;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    },
  ) => {
    const font = options?.font ?? helvetica;
    const size = options?.size ?? FONT_BODY;
    const color = options?.color ?? BLACK;

    page.drawText(text, {
      x,
      y: yPos,
      size,
      font,
      color,
      maxWidth: options?.maxWidth,
    });
  };

  // Helper: draw horizontal line
  const drawLine = (x1: number, yPos: number, x2: number, thickness = 0.5) => {
    page.drawLine({
      start: { x: x1, y: yPos },
      end: { x: x2, y: yPos },
      thickness,
      color: DARK_GRAY,
    });
  };

  // Helper: format currency
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' EUR';
  };

  // Helper: format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Helper: check page break
  const checkPageBreak = (needed: number): void => {
    if (y - needed < MARGIN_BOTTOM + 100) {
      // Reserve 100pt for footer
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      y = A4_HEIGHT - MARGIN_TOP;
    }
  };

  // ─── 1. Kanzlei Header (top-right) ────────────────────────────────────────

  const kanzlei = data.kanzlei;
  const headerX = A4_WIDTH - MARGIN_RIGHT - 200;

  drawText(kanzlei.name, headerX, y, {
    font: helveticaBold,
    size: FONT_HEADING,
    color: BRAND_BLUE,
  });
  y -= LINE_HEIGHT;

  if (kanzlei.strasse) {
    drawText(kanzlei.strasse, headerX, y, { size: FONT_SMALL, color: DARK_GRAY });
    y -= 10;
  }
  const cityLine = [kanzlei.plz, kanzlei.ort].filter(Boolean).join(' ');
  if (cityLine) {
    drawText(cityLine, headerX, y, { size: FONT_SMALL, color: DARK_GRAY });
    y -= 10;
  }
  if (kanzlei.telefon) {
    drawText(`Tel: ${kanzlei.telefon}`, headerX, y, { size: FONT_SMALL, color: DARK_GRAY });
    y -= 10;
  }
  if (kanzlei.email) {
    drawText(kanzlei.email, headerX, y, { size: FONT_SMALL, color: DARK_GRAY });
    y -= 10;
  }

  // Separator line
  y -= 5;
  drawLine(MARGIN_LEFT, y, A4_WIDTH - MARGIN_RIGHT, 1);
  y -= 20;

  // ─── 2. Absenderzeile (compact sender above recipient) ────────────────────

  const absenderParts = [kanzlei.name, kanzlei.strasse, cityLine].filter(Boolean);
  drawText(absenderParts.join(' - '), MARGIN_LEFT, y, {
    size: FONT_SMALL,
    color: DARK_GRAY,
  });
  y -= 18;

  // ─── 3. Recipient Block (DIN 5008 window position) ────────────────────────

  const empf = data.empfaenger;
  drawText(empf.name, MARGIN_LEFT, y, { font: helveticaBold, size: FONT_BODY });
  y -= LINE_HEIGHT;

  if (empf.strasse) {
    drawText(empf.strasse, MARGIN_LEFT, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  }
  const empfCity = [empf.plz, empf.ort].filter(Boolean).join(' ');
  if (empfCity) {
    drawText(empfCity, MARGIN_LEFT, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  }
  if (empf.land && empf.land !== 'Deutschland') {
    drawText(empf.land, MARGIN_LEFT, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  }

  y -= 25;

  // ─── 4. Invoice Header Block ──────────────────────────────────────────────

  // Title
  const titleText = data.isStorno ? 'STORNORECHNUNG' : 'RECHNUNG';
  drawText(titleText, MARGIN_LEFT, y, {
    font: helveticaBold,
    size: FONT_TITLE,
    color: BRAND_BLUE,
  });
  y -= 25;

  // Info columns
  const labelX = MARGIN_LEFT;
  const valueX = MARGIN_LEFT + 130;
  const rightLabelX = A4_WIDTH / 2 + 20;
  const rightValueX = A4_WIDTH / 2 + 150;

  drawText('Rechnungsnummer:', labelX, y, { font: helveticaBold, size: FONT_BODY });
  drawText(data.rechnungsnummer, valueX, y, { size: FONT_BODY });
  drawText('Datum:', rightLabelX, y, { font: helveticaBold, size: FONT_BODY });
  drawText(formatDate(data.rechnungsdatum), rightValueX, y, { size: FONT_BODY });
  y -= LINE_HEIGHT;

  if (data.aktenzeichen) {
    drawText('Aktenzeichen:', labelX, y, { font: helveticaBold, size: FONT_BODY });
    drawText(data.aktenzeichen, valueX, y, { size: FONT_BODY });
  }
  if (data.faelligAm) {
    drawText('Faellig am:', rightLabelX, y, { font: helveticaBold, size: FONT_BODY });
    drawText(formatDate(data.faelligAm), rightValueX, y, { size: FONT_BODY });
  }
  y -= LINE_HEIGHT;

  if (data.mandantName) {
    drawText('Mandant:', labelX, y, { font: helveticaBold, size: FONT_BODY });
    drawText(data.mandantName, valueX, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  }

  if (data.stornoVon) {
    drawText('Storno von:', labelX, y, { font: helveticaBold, size: FONT_BODY });
    drawText(data.stornoVon, valueX, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  }

  y -= 15;

  // ─── 5. Position Table ────────────────────────────────────────────────────

  // Table header
  const colNr = MARGIN_LEFT;
  const colVv = MARGIN_LEFT + 25;
  const colDesc = MARGIN_LEFT + 75;
  const colMenge = MARGIN_LEFT + 280;
  const colPreis = MARGIN_LEFT + 320;
  const colUst = MARGIN_LEFT + 390;
  const colBetrag = MARGIN_LEFT + 430;

  // Header background
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 3,
    width: CONTENT_WIDTH,
    height: TABLE_ROW_HEIGHT,
    color: LIGHT_GRAY,
  });

  drawText('Nr', colNr, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('VV-Nr', colVv, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('Beschreibung', colDesc, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('Menge', colMenge, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('Einzelpreis', colPreis, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('USt %', colUst, y, { font: helveticaBold, size: FONT_SMALL });
  drawText('Betrag', colBetrag, y, { font: helveticaBold, size: FONT_SMALL });

  y -= TABLE_ROW_HEIGHT;
  drawLine(MARGIN_LEFT, y + 2, A4_WIDTH - MARGIN_RIGHT);

  // Table rows
  data.positionen.forEach((pos: InvoicePosition, index: number) => {
    checkPageBreak(TABLE_ROW_HEIGHT);
    y -= 2;

    drawText(String(index + 1), colNr, y, { size: FONT_SMALL });
    if (pos.vvNr) {
      drawText(pos.vvNr, colVv, y, { size: FONT_SMALL });
    }

    // Truncate description if too long
    const desc = pos.beschreibung.length > 35
      ? pos.beschreibung.substring(0, 33) + '..'
      : pos.beschreibung;
    drawText(desc, colDesc, y, { size: FONT_SMALL });

    drawText(String(pos.menge), colMenge, y, { size: FONT_SMALL });
    drawText(formatCurrency(pos.einzelpreis), colPreis, y, { size: FONT_SMALL });
    drawText(`${pos.ustSatz}%`, colUst, y, { size: FONT_SMALL });
    drawText(formatCurrency(pos.betrag), colBetrag, y, { size: FONT_SMALL });

    y -= TABLE_ROW_HEIGHT;
  });

  // ─── 6. Totals ────────────────────────────────────────────────────────────

  y -= 5;
  drawLine(MARGIN_LEFT, y, A4_WIDTH - MARGIN_RIGHT, 1);
  y -= LINE_HEIGHT + 2;

  const totalsLabelX = A4_WIDTH - MARGIN_RIGHT - 230;
  const totalsValueX = A4_WIDTH - MARGIN_RIGHT - 80;

  // Netto
  drawText('Nettobetrag:', totalsLabelX, y, { font: helveticaBold, size: FONT_BODY });
  drawText(formatCurrency(data.betragNetto), totalsValueX, y, { size: FONT_BODY });
  y -= LINE_HEIGHT;

  // Per-rate USt breakdown
  data.ustSummary.forEach((ust: UstSummary) => {
    checkPageBreak(LINE_HEIGHT);
    drawText(
      `USt ${ust.satz}% auf ${formatCurrency(ust.bemessungsgrundlage)}:`,
      totalsLabelX,
      y,
      { size: FONT_BODY, color: DARK_GRAY },
    );
    drawText(formatCurrency(ust.betrag), totalsValueX, y, { size: FONT_BODY });
    y -= LINE_HEIGHT;
  });

  // Brutto
  y -= 3;
  drawLine(totalsLabelX, y, A4_WIDTH - MARGIN_RIGHT, 1);
  y -= LINE_HEIGHT;

  drawText('Bruttobetrag:', totalsLabelX, y, {
    font: helveticaBold,
    size: FONT_HEADING,
    color: BRAND_BLUE,
  });
  drawText(formatCurrency(data.betragBrutto), totalsValueX, y, {
    font: helveticaBold,
    size: FONT_HEADING,
  });
  y -= LINE_HEIGHT * 2;

  // ─── 7. Payment Terms ─────────────────────────────────────────────────────

  if (data.faelligAm) {
    drawText(
      `Zahlbar innerhalb von ${data.zahlungszielTage} Tagen (bis ${formatDate(data.faelligAm)}).`,
      MARGIN_LEFT,
      y,
      { size: FONT_BODY },
    );
    y -= LINE_HEIGHT;
  }

  // Notes
  if (data.notizen) {
    y -= 5;
    drawText('Hinweis:', MARGIN_LEFT, y, { font: helveticaBold, size: FONT_BODY });
    y -= LINE_HEIGHT;
    drawText(data.notizen, MARGIN_LEFT, y, {
      size: FONT_SMALL,
      color: DARK_GRAY,
      maxWidth: CONTENT_WIDTH,
    });
    y -= LINE_HEIGHT;
  }

  // ─── 8. Footer: SS 14 UStG Info + Bankverbindung ──────────────────────────

  // Draw footer at bottom of page
  const footerY = MARGIN_BOTTOM + 50;

  drawLine(MARGIN_LEFT, footerY + 10, A4_WIDTH - MARGIN_RIGHT, 0.5);

  // Three-column footer
  const footCol1 = MARGIN_LEFT;
  const footCol2 = MARGIN_LEFT + CONTENT_WIDTH / 3;
  const footCol3 = MARGIN_LEFT + (CONTENT_WIDTH * 2) / 3;

  let fy = footerY;

  // Column 1: Kanzlei
  drawText(kanzlei.name, footCol1, fy, { font: helveticaBold, size: FONT_SMALL, color: DARK_GRAY });
  fy -= 9;
  if (kanzlei.strasse) {
    drawText(kanzlei.strasse, footCol1, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }
  if (cityLine) {
    drawText(cityLine, footCol1, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }

  // Column 2: Tax info (SS 14 UStG required)
  fy = footerY;
  if (kanzlei.steuernr) {
    drawText(`Steuernr: ${kanzlei.steuernr}`, footCol2, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }
  if (kanzlei.ustIdNr) {
    drawText(`USt-IdNr: ${kanzlei.ustIdNr}`, footCol2, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }

  // Column 3: Bank details
  fy = footerY;
  if (kanzlei.bankName) {
    drawText(kanzlei.bankName, footCol3, fy, { font: helveticaBold, size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }
  if (kanzlei.iban) {
    drawText(`IBAN: ${kanzlei.iban}`, footCol3, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }
  if (kanzlei.bic) {
    drawText(`BIC: ${kanzlei.bic}`, footCol3, fy, { size: FONT_SMALL, color: DARK_GRAY });
    fy -= 9;
  }

  // Serialize
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
