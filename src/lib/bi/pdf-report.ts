import { jsPDF } from "jspdf";
import type { KpiTile, TrendSeries } from "@/lib/bi/types";

// ─── Domain Labels ──────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  akten: "Akten",
  finanzen: "Finanzen",
  fristen: "Fristen",
  helena: "Helena",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number, unit?: string): string {
  if (unit === "EUR") {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  }
  if (unit === "%") {
    return `${value.toFixed(1)} %`;
  }
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} %`;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── PDF Report Generator ───────────────────────────────────────────────────

/**
 * Generates a BI report PDF with Kanzlei-Briefkopf, KPI table, and trend tables.
 */
export function generateBiPdfReport(
  tiles: KpiTile[],
  trends: TrendSeries[],
  zeitraum: { von: string; bis: string },
  kanzleiName?: string
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;
  let pageNumber = 1;

  const generatedAt = new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // ─── Helper: Check page break ─────────────────────────────────────────────
  function checkPageBreak(neededHeight: number): void {
    if (y + neededHeight > pageHeight - 25) {
      addFooter();
      doc.addPage();
      pageNumber++;
      y = 20;
    }
  }

  // ─── Helper: Add footer ───────────────────────────────────────────────────
  function addFooter(): void {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Seite ${pageNumber}`, marginLeft, pageHeight - 10);
    doc.text(`Erstellt: ${generatedAt}`, pageWidth - marginRight, pageHeight - 10, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }

  // ─── Briefkopf (Header) ──────────────────────────────────────────────────
  const name = kanzleiName || "Kanzlei";
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(name, marginLeft, y);
  y += 8;

  // Horizontal line
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 6;

  // Subtitle
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("BI-Report", marginLeft, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Zeitraum: ${formatDate(zeitraum.von)} - ${formatDate(zeitraum.bis)}`,
    marginLeft,
    y
  );
  doc.setTextColor(0, 0, 0);
  y += 12;

  // ─── KPI Section ──────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Kennzahlen", marginLeft, y);
  y += 8;

  // Group tiles by domain
  const domains = ["akten", "finanzen", "fristen", "helena"];
  const colWidths = [contentWidth * 0.3, contentWidth * 0.2, contentWidth * 0.25, contentWidth * 0.25];
  const colX = [
    marginLeft,
    marginLeft + colWidths[0],
    marginLeft + colWidths[0] + colWidths[1],
    marginLeft + colWidths[0] + colWidths[1] + colWidths[2],
  ];

  // Table header
  checkPageBreak(12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(219, 234, 254); // light blue
  doc.rect(marginLeft, y - 4, contentWidth, 7, "F");
  doc.text("KPI", colX[0] + 2, y);
  doc.text("Wert", colX[1] + 2, y);
  doc.text("Vorperiode", colX[2] + 2, y);
  doc.text("Veraenderung", colX[3] + 2, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const domain of domains) {
    const domainTiles = tiles.filter((t) => t.domain === domain);
    if (domainTiles.length === 0) continue;

    // Domain header row
    checkPageBreak(12);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, y - 4, contentWidth, 6, "F");
    doc.text(DOMAIN_LABELS[domain] || domain, colX[0] + 2, y);
    y += 6;
    doc.setFont("helvetica", "normal");

    // KPI rows
    for (const tile of domainTiles) {
      checkPageBreak(8);
      doc.text(tile.label, colX[0] + 4, y);
      doc.text(formatValue(tile.value, tile.unit), colX[1] + 2, y);
      doc.text(formatValue(tile.previousValue, tile.unit), colX[2] + 2, y);

      // Color the delta
      if (tile.delta > 0) {
        doc.setTextColor(0, 128, 0);
      } else if (tile.delta < 0) {
        doc.setTextColor(200, 0, 0);
      }
      doc.text(formatDelta(tile.delta), colX[3] + 2, y);
      doc.setTextColor(0, 0, 0);

      y += 6;
    }
  }

  y += 8;

  // ─── Trend Section ────────────────────────────────────────────────────────
  checkPageBreak(20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Trends", marginLeft, y);
  y += 8;

  for (const series of trends) {
    checkPageBreak(20);

    // Series heading
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(series.label, marginLeft, y);
    y += 6;

    // Table header
    const trendColWidth = contentWidth / 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(219, 234, 254);
    doc.rect(marginLeft, y - 4, contentWidth, 7, "F");
    doc.text("Monat", marginLeft + 2, y);
    doc.text("Wert", marginLeft + trendColWidth + 2, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Determine unit from series ID
    let trendUnit: string | undefined;
    if (series.id === "umsatz-monat") trendUnit = "EUR";
    else if (series.id === "fristen-compliance") trendUnit = "%";

    for (const point of series.data) {
      checkPageBreak(7);
      doc.text(point.label, marginLeft + 2, y);
      doc.text(formatValue(point.value, trendUnit), marginLeft + trendColWidth + 2, y);
      y += 5;
    }

    y += 6;
  }

  // Final footer on last page
  addFooter();

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
