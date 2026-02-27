/**
 * ONLYOFFICE Document Server integration.
 * Handles editor config generation, JWT signing, stable document key generation,
 * and Schreibschutz enforcement for approved documents.
 */

import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import {
  getFileStream,
  uploadFile,
  deleteFile,
  getInternalDownloadUrl,
} from "@/lib/storage";
import { applyBriefkopfToDocx } from "@/lib/briefkopf";
import { convertBufferToPdf } from "@/lib/briefkopf";

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL ?? "http://localhost:8080";
// Internal URL for server-to-server calls to ONLYOFFICE (e.g. PDF conversion)
const ONLYOFFICE_INTERNAL_URL =
  process.env.ONLYOFFICE_INTERNAL_URL ?? ONLYOFFICE_URL;
const ONLYOFFICE_SECRET = process.env.ONLYOFFICE_SECRET ?? "";
// URL that ONLYOFFICE (running in Docker) uses to reach the Next.js app
const APP_INTERNAL_URL =
  process.env.APP_INTERNAL_URL ?? "http://host.docker.internal:3000";

export { ONLYOFFICE_URL, ONLYOFFICE_INTERNAL_URL, APP_INTERNAL_URL };

/**
 * Resolve the public OnlyOffice URL for the browser.
 *
 * Fire & Forget: if ONLYOFFICE_URL points to localhost, the hostname is
 * derived from the incoming request headers so the URL is always correct
 * regardless of the server's IP — no SERVER_HOST config required.
 *
 * Falls back to the explicit ONLYOFFICE_URL if it's already a non-localhost
 * address (e.g. a custom domain override).
 */
export function resolvePublicOnlyOfficeUrl(requestHeaders: Headers): string {
  const configured = new URL(ONLYOFFICE_URL);

  // Explicit non-localhost override — use as-is
  if (
    configured.hostname !== "localhost" &&
    configured.hostname !== "127.0.0.1"
  ) {
    return ONLYOFFICE_URL;
  }

  // Derive hostname from request (works for any server IP without config)
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = requestHeaders.get("host") ?? "localhost";
  const rawHost = forwardedHost ?? host;
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  // Strip port from host header, keep OnlyOffice's own port
  const hostname = rawHost.split(":")[0];
  const port = configured.port || "8080";

  return `${proto}://${hostname}:${port}`;
}

/**
 * Rewrite a URL returned by ONLYOFFICE (e.g. saved file URL in callbacks,
 * converted file URL) so that it's reachable from the app container.
 * ONLYOFFICE may return URLs with its own internal hostname (e.g. http://localhost/...)
 * which the app container can't resolve. We replace the origin with ONLYOFFICE_INTERNAL_URL.
 */
export function rewriteOnlyOfficeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const internal = new URL(ONLYOFFICE_INTERNAL_URL);
    parsed.protocol = internal.protocol;
    parsed.hostname = internal.hostname;
    parsed.port = internal.port;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * ONLYOFFICE document type mapping based on file extension.
 */
type OODocumentType = "word" | "cell" | "slide";

const EXTENSION_TO_TYPE: Record<string, OODocumentType> = {
  // Word processing
  docx: "word",
  doc: "word",
  odt: "word",
  rtf: "word",
  txt: "word",
  html: "word",
  htm: "word",
  epub: "word",
  // Spreadsheets
  xlsx: "cell",
  xls: "cell",
  ods: "cell",
  csv: "cell",
  // Presentations
  pptx: "slide",
  ppt: "slide",
  odp: "slide",
};

/**
 * MIME types that ONLYOFFICE can edit.
 */
const EDITABLE_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "application/vnd.oasis.opendocument.text", // odt
  "application/rtf", // rtf
  "text/plain", // txt
  "text/html", // html
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.oasis.opendocument.spreadsheet", // ods
  "text/csv", // csv
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.ms-powerpoint", // ppt
  "application/vnd.oasis.opendocument.presentation", // odp
]);

/**
 * MIME types that ONLYOFFICE can view (but not edit).
 */
const VIEWABLE_MIMETYPES = new Set(
  Array.from(EDITABLE_MIMETYPES).concat([
    "application/pdf",
    "application/epub+zip",
  ])
);

/**
 * Check if a document can be edited in ONLYOFFICE.
 */
export function isEditableInOnlyOffice(mimeType: string): boolean {
  return EDITABLE_MIMETYPES.has(mimeType);
}

/**
 * Check if a document can be viewed in ONLYOFFICE.
 */
export function isViewableInOnlyOffice(mimeType: string): boolean {
  return VIEWABLE_MIMETYPES.has(mimeType);
}

/**
 * Get the file extension from a filename.
 */
function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Get the ONLYOFFICE document type for a file.
 */
function getDocumentType(fileName: string): OODocumentType {
  const ext = getExtension(fileName);
  return EXTENSION_TO_TYPE[ext] ?? "word";
}

/**
 * Sign a payload with the ONLYOFFICE shared secret.
 */
export function signPayload(payload: Record<string, unknown>): string {
  if (!ONLYOFFICE_SECRET) {
    throw new Error("ONLYOFFICE_SECRET is not configured");
  }
  return jwt.sign(payload, ONLYOFFICE_SECRET);
}

/**
 * Verify a JWT token from ONLYOFFICE.
 */
export function verifyToken(token: string): Record<string, unknown> {
  if (!ONLYOFFICE_SECRET) {
    throw new Error("ONLYOFFICE_SECRET is not configured");
  }
  return jwt.verify(token, ONLYOFFICE_SECRET) as Record<string, unknown>;
}

/**
 * Generate a stable document key for ONLYOFFICE co-editing.
 * Format: {dokumentId}_v{version}
 *
 * CRITICAL: Same key = same editing session = co-editing works.
 * The key only changes after a save (status 2) increments the version,
 * so the next editor open gets a fresh session with the updated content.
 */
export function generateDocumentKey(
  dokumentId: string,
  version: number
): string {
  return `${dokumentId}_v${version}`;
}

/** Document statuses that enforce read-only (Schreibschutz) */
const READ_ONLY_STATUSES = new Set(["FREIGEGEBEN", "VERSENDET"]);

interface EditorConfigParams {
  dokumentId: string;
  fileName: string;
  mimeType: string;
  userId: string;
  userName: string;
  version: number;
  dokumentStatus: string;
  mode?: "edit" | "view";
}

/**
 * Build the full ONLYOFFICE editor configuration.
 * Uses stable document key (version-based) for co-editing support.
 * Enforces Schreibschutz (read-only) for FREIGEGEBEN/VERSENDET documents.
 */
export function buildEditorConfig({
  dokumentId,
  fileName,
  mimeType,
  userId,
  userName,
  version,
  dokumentStatus,
  mode = "edit",
}: EditorConfigParams) {
  const ext = getExtension(fileName);
  const documentType = getDocumentType(fileName);

  // Schreibschutz: Force view mode for approved/sent documents
  const isReadOnly = READ_ONLY_STATUSES.has(dokumentStatus);

  // Determine effective mode: view if not editable, read-only status, or explicitly requested
  let effectiveMode: "edit" | "view" = "view";
  if (
    mode === "edit" &&
    isEditableInOnlyOffice(mimeType) &&
    !isReadOnly
  ) {
    effectiveMode = "edit";
  }

  // Permissions based on mode
  const permissions = {
    comment: effectiveMode === "edit",
    download: true,
    edit: effectiveMode === "edit",
    print: true,
    review: effectiveMode === "edit", // Track Changes enabled in edit mode
    fillForms: effectiveMode === "edit",
  };

  // Stable document key: same key = same co-editing session
  const key = generateDocumentKey(dokumentId, version);

  // URLs accessible from ONLYOFFICE Docker container
  const downloadUrl = `${APP_INTERNAL_URL}/api/onlyoffice/download/${dokumentId}`;
  const callbackUrl = `${APP_INTERNAL_URL}/api/onlyoffice/callback`;

  // Core config that gets signed in the JWT
  const payload = {
    document: {
      fileType: ext,
      key,
      title: fileName,
      url: downloadUrl,
      permissions,
    },
    documentType,
    editorConfig: {
      callbackUrl:
        effectiveMode === "edit"
          ? `${callbackUrl}?dokumentId=${dokumentId}`
          : undefined,
      lang: "de",
      mode: effectiveMode,
      user: {
        id: userId,
        name: userName,
      },
      customization: {
        autosave: true,
        comments: effectiveMode === "edit",
        compactHeader: false,
        compactToolbar: false,
        feedback: false,
        forcesave: true, // Periodic saves every ~30 seconds
        help: false,
        hideRightMenu: false,
        hideRulers: false,
        toolbarNoTabs: false,
        review: {
          showReviewChanges: true,
          reviewDisplay: "markup",
          trackChanges: effectiveMode === "edit",
        },
      },
    },
  };

  // Sign the document payload if secret is configured
  const token = ONLYOFFICE_SECRET ? signPayload(payload) : undefined;

  return {
    ...payload,
    ...(token ? { token } : {}),
    type: "desktop",
    height: "100%",
    width: "100%",
  };
}

/**
 * MIME types that OnlyOffice can convert to PDF.
 * This is a subset of editable types -- images are NOT convertible via the
 * Conversion API (they need a different approach).
 */
const CONVERTIBLE_TO_PDF = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "application/vnd.oasis.opendocument.text", // odt
  "application/rtf", // rtf
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.oasis.opendocument.spreadsheet", // ods
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.ms-powerpoint", // ppt
  "application/vnd.oasis.opendocument.presentation", // odp
]);

/**
 * Check if a MIME type can be converted to PDF via OnlyOffice.
 */
export function canConvertToPdf(mimeType: string): boolean {
  return CONVERTIBLE_TO_PDF.has(mimeType);
}

/**
 * Convert a document to PDF using the OnlyOffice Conversion API.
 *
 * This calls OnlyOffice's ConvertService.ashx directly (server-to-server),
 * using the app's internal download endpoint so OnlyOffice can fetch the
 * source file from MinIO via Next.js.
 *
 * @param dokumentId - The document ID (used to build download URL)
 * @param fileName - Original filename (used to determine source file type)
 * @returns PDF as Buffer, or null if conversion fails
 */
export async function convertDocumentToPdf(
  dokumentId: string,
  fileName: string
): Promise<Buffer | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "docx";

  // Build download URL accessible from OnlyOffice Docker container
  const downloadUrl = `${APP_INTERNAL_URL}/api/onlyoffice/download/${dokumentId}`;

  // Build conversion request payload
  const conversionPayload: Record<string, unknown> = {
    filetype: ext,
    key: `preview_${dokumentId}_${Date.now()}`,
    outputtype: "pdf",
    title: fileName,
    url: downloadUrl,
  };

  // Sign payload with JWT if OnlyOffice JWT is enabled
  if (ONLYOFFICE_SECRET) {
    try {
      conversionPayload.token = signPayload(conversionPayload);
    } catch (err) {
      console.error("[convertDocumentToPdf] Failed to sign payload:", err);
    }
  }

  try {
    const converterUrl = `${ONLYOFFICE_INTERNAL_URL}/ConvertService.ashx`;
    console.log(
      `[convertDocumentToPdf] Converting ${fileName} (${ext} -> pdf), url=${converterUrl}`
    );

    let conversionResult: { endConvert: boolean; fileUrl?: string } | null =
      null;
    let attempts = 0;
    const maxAttempts = 10;

    // Poll for completion (OnlyOffice conversion can be async)
    while (attempts < maxAttempts) {
      attempts++;

      const convResponse = await fetch(converterUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(conversionPayload),
      });

      if (!convResponse.ok) {
        const errorText = await convResponse.text().catch(() => "Unknown");
        console.error(
          `[convertDocumentToPdf] API error ${convResponse.status}: ${errorText}`
        );
        return null;
      }

      conversionResult = await convResponse.json();

      if (conversionResult?.endConvert && conversionResult.fileUrl) {
        break;
      }

      if (!conversionResult?.endConvert) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!conversionResult?.fileUrl) {
      console.error("[convertDocumentToPdf] No result after polling");
      return null;
    }

    // Rewrite the file URL (OnlyOffice returns internal Docker URLs)
    const fileUrl = rewriteOnlyOfficeUrl(conversionResult.fileUrl);
    console.log(
      `[convertDocumentToPdf] Result URL: original=${conversionResult.fileUrl}, rewritten=${fileUrl}`
    );

    // Download the converted PDF
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.error(
        `[convertDocumentToPdf] Failed to download converted file: ${fileResponse.status}`
      );
      return null;
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[convertDocumentToPdf] Unexpected error:", err);
    return null;
  }
}

/**
 * Generate a PDF preview with Briefkopf (letterhead) injection.
 *
 * Pipeline:
 * 1. Load document from DB
 * 2. Download DOCX from MinIO
 * 3. Load default Briefkopf and apply it to the DOCX
 * 4. Upload merged DOCX to temp MinIO path
 * 5. Convert to PDF via OnlyOffice ConvertService
 * 6. Store PDF in MinIO and update previewPfad in DB
 * 7. Clean up temp file
 *
 * Falls back to conversion without Briefkopf if none is configured.
 */
export async function generatePreviewWithBriefkopf(
  dokumentId: string
): Promise<void> {
  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
    select: { id: true, name: true, akteId: true, dateipfad: true, mimeType: true },
  });

  if (!dokument) {
    console.error(`[PreviewBriefkopf] Document not found: ${dokumentId}`);
    return;
  }

  // 1. Download DOCX from MinIO
  const stream = await getFileStream(dokument.dateipfad);
  if (!stream) {
    console.error(`[PreviewBriefkopf] No file stream for ${dokument.dateipfad}`);
    return;
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  let docBuffer: Buffer = Buffer.from(Buffer.concat(chunks));

  // 2. Load default Briefkopf and apply
  try {
    const briefkopf = await prisma.briefkopf.findFirst({
      where: { istStandard: true },
    });

    if (briefkopf?.dateipfad) {
      const bkStream = await getFileStream(briefkopf.dateipfad);
      if (bkStream) {
        const bkChunks: Uint8Array[] = [];
        for await (const chunk of bkStream as AsyncIterable<Uint8Array>) {
          bkChunks.push(chunk);
        }
        const briefkopfBuffer = Buffer.from(Buffer.concat(bkChunks));
        docBuffer = applyBriefkopfToDocx(Buffer.from(docBuffer), briefkopfBuffer);
        console.log(`[PreviewBriefkopf] Applied Briefkopf "${briefkopf.name}" to ${dokument.name}`);
      }
    }
  } catch (err) {
    console.warn(`[PreviewBriefkopf] Briefkopf apply failed, continuing without:`, err);
  }

  // 3. Upload merged DOCX to temp path
  const tempKey = `temp/preview_${dokumentId}_${Date.now()}.docx`;
  await uploadFile(
    tempKey,
    docBuffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    docBuffer.length
  );

  try {
    // 4. Get internal presigned URL for OnlyOffice to download
    const downloadUrl = await getInternalDownloadUrl(tempKey);

    // 5. Convert to PDF via OnlyOffice
    const pdfBuffer = await convertBufferToPdf(downloadUrl);

    // 6. Store PDF in MinIO
    const previewPath = `akten/${dokument.akteId}/previews/${dokument.id}.pdf`;
    await uploadFile(previewPath, pdfBuffer, "application/pdf", pdfBuffer.length);

    // 7. Update previewPfad in DB
    await prisma.dokument.update({
      where: { id: dokument.id },
      data: { previewPfad: previewPath },
    });

    console.log(
      `[PreviewBriefkopf] Preview generated for ${dokument.name}: ${previewPath} (${pdfBuffer.length} bytes)`
    );
  } finally {
    // 8. Clean up temp file
    await deleteFile(tempKey).catch(() => {});
  }
}
