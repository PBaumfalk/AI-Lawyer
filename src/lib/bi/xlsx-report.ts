import * as ExcelJS from "exceljs";
import { PassThrough } from "stream";
import type { KpiTile, TrendSeries } from "@/lib/bi/types";

// ─── Domain Labels ──────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  akten: "Akten",
  finanzen: "Finanzen",
  fristen: "Fristen",
  helena: "Helena",
};

// ─── Header Style ───────────────────────────────────────────────────────────

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDBEAFE" },
};

function commitHeaderRow(sheet: ExcelJS.Worksheet, colCount: number): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.commit();

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

// ─── XLSX BI Report Generator ───────────────────────────────────────────────

/**
 * Generates a multi-sheet XLSX BI report using ExcelJS streaming.
 */
export async function generateBiXlsxReport(
  tiles: KpiTile[],
  trends: TrendSeries[],
  zeitraum: { von: string; bis: string }
): Promise<Buffer> {
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];

  passThrough.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: passThrough,
    useStyles: true,
  });

  // ─── Sheet 1: Kennzahlen ─────────────────────────────────────────────────
  const kpiSheet = workbook.addWorksheet("Kennzahlen");
  kpiSheet.columns = [
    { header: "Bereich", key: "domain", width: 16 },
    { header: "KPI", key: "kpi", width: 28 },
    { header: "Wert", key: "wert", width: 18 },
    { header: "Vorperiode", key: "vorperiode", width: 18 },
    { header: "Delta (%)", key: "delta", width: 14 },
  ];
  commitHeaderRow(kpiSheet, 5);

  // Group tiles by domain
  const domains = ["akten", "finanzen", "fristen", "helena"];
  for (const domain of domains) {
    const domainTiles = tiles.filter((t) => t.domain === domain);
    for (const tile of domainTiles) {
      const row = kpiSheet.addRow({
        domain: DOMAIN_LABELS[domain] || domain,
        kpi: tile.label,
        wert: tile.value,
        vorperiode: tile.previousValue,
        delta: tile.delta,
      });
      row.commit();
    }
  }

  kpiSheet.commit();

  // ─── Trend Sheets ─────────────────────────────────────────────────────────
  // Map series IDs to sheet names and value headers
  const trendSheetConfig: Record<string, { sheetName: string; valueHeader: string }> = {
    "akten-neuzugang": { sheetName: "Akten-Neuzugang", valueHeader: "Anzahl" },
    "umsatz-monat": { sheetName: "Umsatz", valueHeader: "Betrag (EUR)" },
    "fristen-compliance": { sheetName: "Fristen-Compliance", valueHeader: "Rate (%)" },
  };

  for (const series of trends) {
    const config = trendSheetConfig[series.id];
    if (!config) continue;

    const sheet = workbook.addWorksheet(config.sheetName);
    sheet.columns = [
      { header: "Monat", key: "monat", width: 18 },
      { header: config.valueHeader, key: "wert", width: 20 },
    ];
    commitHeaderRow(sheet, 2);

    for (const point of series.data) {
      const row = sheet.addRow({
        monat: point.label,
        wert: point.value,
      });
      row.commit();
    }

    sheet.commit();
  }

  // Commit workbook
  await workbook.commit();

  // Wait for stream to finish
  await new Promise<void>((resolve) => passThrough.on("end", resolve));

  return Buffer.concat(chunks);
}
