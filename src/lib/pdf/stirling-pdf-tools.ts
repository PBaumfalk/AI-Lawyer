/**
 * Stirling-PDF REST API client for PDF tool operations.
 * Handles merge, split, rotate, compress, watermark, and redact
 * via the Stirling-PDF Docker sidecar service.
 */

const STIRLING_PDF_URL =
  process.env.STIRLING_PDF_URL ?? "http://stirling-pdf:8080";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PdfToolOperation =
  | "merge"
  | "split"
  | "rotate"
  | "compress"
  | "watermark"
  | "redact";

// ─── DSGVO PII Patterns ─────────────────────────────────────────────────────

/**
 * Pre-built regex patterns for common German PII types (DSGVO compliance).
 * Use with autoRedact for automated PII redaction.
 */
export const DSGVO_PII_PATTERNS: Record<string, string> = {
  /** German IBAN: DE followed by 2 check digits and 18 alphanumeric */
  IBAN: "DE\\d{2}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{2}",
  /** German phone numbers: +49 or 0 prefix */
  TELEFON: "(?:\\+49|0)[\\s\\-]?\\(?\\d{2,5}\\)?[\\s\\-]?[\\d\\s\\-]{4,12}",
  /** Email addresses */
  EMAIL: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
  /** German tax ID (Steuernummer): various regional formats */
  STEUERNUMMER: "\\d{2,3}[\\s/]?\\d{3}[\\s/]?\\d{4,5}",
  /** German social security number (Sozialversicherungsnummer): 12 chars */
  SOZIALVERSICHERUNGSNUMMER: "\\d{2}\\s?\\d{6}\\s?[A-Z]\\s?\\d{3}",
  /** German ID card number (Personalausweisnummer) */
  PERSONALAUSWEIS: "[A-Z0-9]{9,10}",
  /** Date of birth patterns (DD.MM.YYYY) */
  GEBURTSDATUM: "\\d{2}\\.\\d{2}\\.\\d{4}",
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function createPdfBlob(buffer: Buffer, filename = "document.pdf"): { blob: Blob; filename: string } {
  return {
    blob: new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    filename,
  };
}

async function callStirlingApi(endpoint: string, formData: FormData): Promise<Buffer> {
  const response = await fetch(`${STIRLING_PDF_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unbekannter Fehler");
    throw new Error(
      `Stirling-PDF ${endpoint} fehlgeschlagen (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── PDF Tool Functions ──────────────────────────────────────────────────────

/**
 * Merge multiple PDFs into a single document.
 *
 * @param buffers - Array of PDF file buffers to merge
 * @param filenames - Corresponding filenames for each buffer
 * @returns Merged PDF as a Buffer
 */
export async function mergePdfs(
  buffers: Buffer[],
  filenames: string[]
): Promise<Buffer> {
  if (buffers.length < 2) {
    throw new Error("Mindestens 2 PDFs zum Zusammenfuehren erforderlich");
  }

  const formData = new FormData();
  for (let i = 0; i < buffers.length; i++) {
    const { blob, filename } = createPdfBlob(buffers[i], filenames[i] ?? `document_${i}.pdf`);
    formData.append("fileInput", blob, filename);
  }

  return callStirlingApi("/api/v1/general/merge-pdfs", formData);
}

/**
 * Split a PDF by page ranges.
 *
 * @param buffer - The PDF file as a Buffer
 * @param pages - Comma-separated page ranges, e.g. "1-3,5,7-9"
 * @returns Split PDF as a Buffer (pages matching the range)
 */
export async function splitPdf(
  buffer: Buffer,
  pages: string
): Promise<Buffer> {
  if (!pages || pages.trim().length === 0) {
    throw new Error("Seitenbereiche muessen angegeben werden (z.B. '1-3,5')");
  }

  const formData = new FormData();
  const { blob, filename } = createPdfBlob(buffer);
  formData.append("fileInput", blob, filename);
  formData.append("pageNumbers", pages);

  return callStirlingApi("/api/v1/general/split-pdf", formData);
}

/**
 * Rotate all pages of a PDF by a given angle.
 *
 * @param buffer - The PDF file as a Buffer
 * @param angle - Rotation angle: 90, 180, or 270 degrees
 * @returns Rotated PDF as a Buffer
 */
export async function rotatePdf(
  buffer: Buffer,
  angle: 90 | 180 | 270
): Promise<Buffer> {
  const formData = new FormData();
  const { blob, filename } = createPdfBlob(buffer);
  formData.append("fileInput", blob, filename);
  formData.append("angle", String(angle));

  return callStirlingApi("/api/v1/general/rotate-pdf", formData);
}

/**
 * Compress a PDF to reduce file size.
 *
 * @param buffer - The PDF file as a Buffer
 * @param level - Compression level: 1 (low) to 5 (maximum)
 * @returns Compressed PDF as a Buffer
 */
export async function compressPdf(
  buffer: Buffer,
  level: 1 | 2 | 3 | 4 | 5 = 3
): Promise<Buffer> {
  const formData = new FormData();
  const { blob, filename } = createPdfBlob(buffer);
  formData.append("fileInput", blob, filename);
  formData.append("optimizeLevel", String(level));

  return callStirlingApi("/api/v1/general/compress-pdf", formData);
}

/**
 * Add a text watermark to a PDF.
 *
 * @param buffer - The PDF file as a Buffer
 * @param text - Watermark text
 * @param fontSize - Font size (default 30)
 * @param rotation - Text rotation angle (default 45)
 * @param opacity - Opacity 0-1 (default 0.5)
 * @returns Watermarked PDF as a Buffer
 */
export async function addWatermark(
  buffer: Buffer,
  text: string,
  fontSize = 30,
  rotation = 45,
  opacity = 0.5
): Promise<Buffer> {
  if (!text || text.trim().length === 0) {
    throw new Error("Wasserzeichen-Text darf nicht leer sein");
  }

  const formData = new FormData();
  const { blob, filename } = createPdfBlob(buffer);
  formData.append("fileInput", blob, filename);
  formData.append("watermarkText", text);
  formData.append("fontSize", String(fontSize));
  formData.append("rotation", String(rotation));
  formData.append("opacity", String(opacity));
  formData.append("watermarkType", "text");

  return callStirlingApi("/api/v1/security/add-watermark", formData);
}

/**
 * Auto-redact text in a PDF matching search patterns.
 *
 * @param buffer - The PDF file as a Buffer
 * @param searchText - Text or regex pattern to search and redact
 * @param useRegex - Whether searchText is a regex pattern
 * @param redactColor - Redaction box color in hex (default "#000000")
 * @returns Redacted PDF as a Buffer
 */
export async function autoRedact(
  buffer: Buffer,
  searchText: string,
  useRegex = false,
  redactColor = "#000000"
): Promise<Buffer> {
  if (!searchText || searchText.trim().length === 0) {
    throw new Error("Suchtext fuer Schwärzung darf nicht leer sein");
  }

  const formData = new FormData();
  const { blob, filename } = createPdfBlob(buffer);
  formData.append("fileInput", blob, filename);
  formData.append("searchText", searchText);
  formData.append("useRegex", String(useRegex));
  formData.append("redactColor", redactColor);

  return callStirlingApi("/api/v1/security/auto-redact", formData);
}

/**
 * Build a combined regex pattern from DSGVO PII pattern keys.
 * Use with autoRedact(buffer, pattern, true) for comprehensive PII redaction.
 *
 * @param patternKeys - Keys from DSGVO_PII_PATTERNS to include (default: all)
 * @returns Combined regex pattern string
 */
export function buildDsgvoPiiPattern(
  patternKeys?: (keyof typeof DSGVO_PII_PATTERNS)[]
): string {
  const keys = patternKeys ?? (Object.keys(DSGVO_PII_PATTERNS) as (keyof typeof DSGVO_PII_PATTERNS)[]);
  const patterns = keys
    .map((key) => DSGVO_PII_PATTERNS[key])
    .filter(Boolean);

  if (patterns.length === 0) {
    throw new Error("Keine DSGVO-Muster ausgewaehlt");
  }

  return patterns.map((p) => `(${p})`).join("|");
}
