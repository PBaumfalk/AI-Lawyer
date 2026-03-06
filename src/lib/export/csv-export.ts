import type { ExportConfig } from "./types";

/**
 * Generates a CSV string from data using the given export config.
 * Uses semicolon delimiter (German Excel default) and UTF-8 BOM for umlaut support.
 */
export function generateCsv(
  data: Record<string, any>[],
  config: ExportConfig
): string {
  const BOM = "\uFEFF";
  const DELIMITER = ";";

  // Header row
  const headerRow = config.columns.map((col) => escapeField(col.header)).join(DELIMITER);

  // Data rows
  const dataRows = data.map((row) => {
    return config.columns
      .map((col) => {
        const raw = row[col.key];
        const value = col.transform ? col.transform(raw) : (raw ?? "");
        return escapeField(String(value));
      })
      .join(DELIMITER);
  });

  return BOM + [headerRow, ...dataRows].join("\r\n");
}

/**
 * Escapes a CSV field: wraps in double quotes if it contains
 * semicolons, newlines, or double quotes.
 */
function escapeField(value: string): string {
  if (
    value.includes(";") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes('"')
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
