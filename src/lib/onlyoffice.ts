/**
 * ONLYOFFICE Document Server integration.
 * Handles editor config generation, JWT signing, stable document key generation,
 * and Schreibschutz enforcement for approved documents.
 */

import jwt from "jsonwebtoken";

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL ?? "http://localhost:8080";
// Internal URL for server-to-server calls to ONLYOFFICE (e.g. PDF conversion)
const ONLYOFFICE_INTERNAL_URL =
  process.env.ONLYOFFICE_INTERNAL_URL ?? ONLYOFFICE_URL;
const ONLYOFFICE_SECRET = process.env.ONLYOFFICE_SECRET ?? "";
// URL that ONLYOFFICE (running in Docker) uses to reach the Next.js app
const APP_INTERNAL_URL =
  process.env.APP_INTERNAL_URL ?? "http://host.docker.internal:3000";

export { ONLYOFFICE_URL, ONLYOFFICE_INTERNAL_URL };

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
