export type ExportFormat = "csv" | "xlsx";

export interface ExportColumn {
  key: string; // field name in data object
  header: string; // German column header
  width?: number; // XLSX column width (characters)
  transform?: (value: any) => string | number; // optional value transformer
}

export interface ExportConfig {
  filename: string; // without extension
  sheetName: string; // XLSX sheet name
  columns: ExportColumn[];
}
