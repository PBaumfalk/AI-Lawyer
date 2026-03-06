import * as ExcelJS from "exceljs";
import { PassThrough } from "stream";
import type { ExportConfig } from "./types";

/**
 * Generates an XLSX buffer from data using ExcelJS streaming WorkbookWriter.
 * Handles large datasets without memory issues via streaming.
 */
export async function generateXlsx(
  data: Record<string, any>[],
  config: ExportConfig
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

  const worksheet = workbook.addWorksheet(config.sheetName);

  // Set columns with header and width
  worksheet.columns = config.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));

  // Style header row: bold, light blue fill, auto-filter
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDBEAFE" },
  };
  headerRow.commit();

  // Enable auto-filter on all columns
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: config.columns.length },
  };

  // Add data rows
  for (const record of data) {
    const rowData: Record<string, any> = {};
    for (const col of config.columns) {
      const raw = record[col.key];
      rowData[col.key] = col.transform ? col.transform(raw) : (raw ?? "");
    }
    const row = worksheet.addRow(rowData);
    row.commit();
  }

  // Commit worksheet and workbook
  worksheet.commit();
  await workbook.commit();

  // Wait for stream to finish
  await new Promise<void>((resolve) => passThrough.on("end", resolve));

  return Buffer.concat(chunks);
}
