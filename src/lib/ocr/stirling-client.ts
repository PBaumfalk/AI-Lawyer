/**
 * Stirling-PDF REST API client.
 * Handles OCR processing, document-to-PDF conversion, and image-to-PDF conversion
 * via the Stirling-PDF Docker sidecar service.
 */

const STIRLING_PDF_URL =
  process.env.STIRLING_PDF_URL ?? "http://stirling-pdf:8080";

/**
 * OCR a PDF document using Stirling-PDF.
 * Uses skip-text mode to avoid re-processing already searchable text.
 *
 * @param pdfBuffer - The PDF file as a Buffer
 * @param languages - OCR languages (default: "deu,eng" for German + English)
 * @returns The OCR'd PDF as a Buffer
 */
export async function ocrPdf(
  pdfBuffer: Buffer,
  languages = "deu,eng"
): Promise<Buffer> {
  const formData = new FormData();
  formData.append(
    "fileInput",
    new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
    "document.pdf"
  );
  formData.append("languages", languages);
  formData.append("sidecar", "false");
  formData.append("deskew", "false");
  formData.append("clean", "false");
  formData.append("cleanFinal", "false");
  formData.append("ocrType", "skip-text");
  formData.append("ocrRenderType", "hocr");

  const response = await fetch(`${STIRLING_PDF_URL}/api/v1/misc/ocr-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stirling-PDF OCR failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convert a document file (DOCX, ODT, etc.) to PDF via Stirling-PDF.
 *
 * @param fileBuffer - The source document as a Buffer
 * @param filename - Original filename (used for MIME detection)
 * @returns The converted PDF as a Buffer
 */
export async function convertToPdf(
  fileBuffer: Buffer,
  filename: string
): Promise<Buffer> {
  const formData = new FormData();
  formData.append(
    "fileInput",
    new Blob([new Uint8Array(fileBuffer)]),
    filename
  );

  const response = await fetch(
    `${STIRLING_PDF_URL}/api/v1/convert/file/pdf`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stirling-PDF convert failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convert an image file to PDF via Stirling-PDF.
 *
 * @param imageBuffer - The image file as a Buffer
 * @param filename - Original filename
 * @returns The converted PDF as a Buffer
 */
export async function convertImageToPdf(
  imageBuffer: Buffer,
  filename: string
): Promise<Buffer> {
  const formData = new FormData();
  formData.append(
    "fileInput",
    new Blob([new Uint8Array(imageBuffer)]),
    filename
  );

  const response = await fetch(
    `${STIRLING_PDF_URL}/api/v1/convert/img/pdf`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stirling-PDF image convert failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Check if the Stirling-PDF service is healthy and responsive.
 */
export async function checkStirlingHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `${STIRLING_PDF_URL}/api/v1/info/status`,
      { signal: AbortSignal.timeout(5000) }
    );
    return response.ok;
  } catch {
    return false;
  }
}
