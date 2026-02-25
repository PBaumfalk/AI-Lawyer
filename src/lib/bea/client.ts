"use client";

/**
 * bea.expert API Client Wrapper (browser-only)
 *
 * Encapsulates all bea.expert REST API calls for the beA (besonderes
 * elektronisches Anwaltspostfach) integration.
 *
 * Architecture: Since bea.expert requires browser-side authentication
 * (crypto operations with software token), this module runs ONLY in the browser.
 * Session keys are never transmitted to the server.
 *
 * Library loading: The bea.expert JS library is loaded dynamically. If it is
 * not available (not installed or CDN unreachable), all functions return
 * structured errors with a "beA-Bibliothek konnte nicht geladen werden" message.
 *
 * When the bea.expert library becomes available (npm package or vendor file),
 * update loadBeaExpertLib() to point to the correct import path.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BeaSession {
  /** Derived session keys from software token login */
  sessionKeys: unknown;
  /** Authenticated SAFE-ID */
  safeId: string;
  /** Display name of the authenticated user */
  displayName: string;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp for timeout tracking */
  lastActivity: number;
}

export interface BeaPostbox {
  safeId: string;
  name: string;
  type: "ANWALT" | "KANZLEI" | "ORGANISATIONSPOSTFACH";
}

export interface BeaFolder {
  id: string;
  name: string;
  parentId?: string;
  messageCount: number;
  children: BeaFolder[];
}

export interface BeaMessageSummary {
  id: string;
  nachrichtenId: string;
  betreff: string;
  absender: string;
  absenderSafeId: string;
  empfaenger: string;
  empfaengerSafeId: string;
  datum: string;
  gelesen: boolean;
  hasAttachments: boolean;
  eebErforderlich: boolean;
}

export interface BeaMessageDetail extends BeaMessageSummary {
  inhalt: string;
  anhaenge: BeaAttachment[];
  pruefprotokoll?: BeaPruefprotokoll;
  xjustizXml?: string;
}

export interface BeaAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Base64 encoded content (after decryption) */
  content?: string;
}

export interface BeaPruefprotokoll {
  ergebnis: "GUELTIG" | "UNGUELTIG" | "UNBEKANNT";
  zeitpunkt: string;
  details: Array<{
    pruefung: string;
    ergebnis: string;
    hinweis?: string;
  }>;
}

export interface BeaSendPayload {
  recipientSafeId: string;
  subject: string;
  body: string;
  attachments: Array<{
    name: string;
    mimeType: string;
    /** Base64 encoded file content */
    content: string;
  }>;
}

export interface BeaResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: "LIB_NOT_LOADED" | "SESSION_EXPIRED" | "API_ERROR" | "NETWORK_ERROR";
}

// ─── Library Loader ──────────────────────────────────────────────────────────

/**
 * bea.expert library loading status.
 * The library is loaded once and cached.
 */
let beaLib: unknown = null;
let beaLibError: string | null = null;
let beaLibLoading = false;

/**
 * Dynamically loads the bea.expert JavaScript library.
 *
 * Currently configured to load from window global (CDN script tag approach)
 * or via dynamic import if available as a module.
 *
 * To configure:
 * 1. CDN: Add <script src="https://cdn.bea.expert/api.js"> to layout, then
 *    this function reads window.beaExpert.
 * 2. npm: Update import path to the correct package name.
 * 3. Vendor: Place library at src/lib/bea/vendor/bea-expert-api.js and
 *    import via relative path.
 */
async function loadBeaExpertLib(): Promise<unknown> {
  if (beaLib) return beaLib;
  if (beaLibError) return null;
  if (beaLibLoading) {
    // Wait for concurrent load attempt
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!beaLibLoading) {
          clearInterval(interval);
          resolve(beaLib);
        }
      }, 100);
    });
  }

  beaLibLoading = true;

  try {
    // Strategy 1: Check for window global (CDN loaded)
    if (typeof window !== "undefined" && (window as any).beaExpert) {
      beaLib = (window as any).beaExpert;
      beaLibLoading = false;
      return beaLib;
    }

    // Strategy 2: Dynamic import (npm package or vendor file)
    // Uncomment and update when library becomes available:
    // beaLib = await import('bea-expert-api');
    // beaLib = await import('./vendor/bea-expert-api');

    // If no strategy works, the library is not available
    beaLibError = "beA-Bibliothek konnte nicht geladen werden. " +
      "Bitte stellen Sie sicher, dass die bea.expert Bibliothek konfiguriert ist.";
    beaLibLoading = false;
    return null;
  } catch (err) {
    beaLibError = `beA-Bibliothek konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`;
    beaLibLoading = false;
    return null;
  }
}

function makeError<T>(message: string, code: BeaResult<T>["code"] = "LIB_NOT_LOADED"): BeaResult<T> {
  return { ok: false, error: message, code };
}

/**
 * Checks whether the session is still valid (30-minute inactivity timeout).
 */
function isSessionValid(session: BeaSession | null): session is BeaSession {
  if (!session) return false;
  const THIRTY_MINUTES = 30 * 60 * 1000;
  return Date.now() - session.lastActivity < THIRTY_MINUTES;
}

/**
 * Updates the lastActivity timestamp on the session.
 */
function touchSession(session: BeaSession): void {
  session.lastActivity = Date.now();
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Initiates browser-side beA login using a software token file and PIN.
 * The bea.expert library performs token processing and session key derivation
 * entirely in the browser -- no secrets leave the client.
 */
export async function beaLogin(
  softwareToken: File,
  pin: string
): Promise<BeaResult<BeaSession>> {
  try {
    const lib = await loadBeaExpertLib();
    if (!lib) {
      return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");
    }

    const api = lib as any;
    const tokenBuffer = await softwareToken.arrayBuffer();
    const result = await api.login(tokenBuffer, pin);

    if (!result || !result.sessionKeys) {
      return makeError("Anmeldung fehlgeschlagen. Bitte pruefen Sie Token und PIN.", "API_ERROR");
    }

    const session: BeaSession = {
      sessionKeys: result.sessionKeys,
      safeId: result.safeId || "",
      displayName: result.displayName || "",
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    return { ok: true, data: session };
  } catch (err) {
    return makeError(
      `Anmeldung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Retrieves all accessible postboxes for the authenticated user.
 */
export async function beaGetPostboxes(
  session: BeaSession
): Promise<BeaResult<BeaPostbox[]>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const result = await api.getPostboxOverview(session.sessionKeys);
    touchSession(session);

    const postboxes: BeaPostbox[] = (result || []).map((pb: any) => ({
      safeId: pb.safeId || pb.safe_id || "",
      name: pb.name || pb.displayName || "",
      type: pb.type || "ANWALT",
    }));

    return { ok: true, data: postboxes };
  } catch (err) {
    return makeError(
      `Postfaecher konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Retrieves the folder tree for a given postbox.
 */
export async function beaGetFolders(
  session: BeaSession,
  safeId: string
): Promise<BeaResult<BeaFolder[]>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const result = await api.getFolderOverview(session.sessionKeys, safeId);
    touchSession(session);

    const mapFolder = (f: any): BeaFolder => ({
      id: f.id || f.folderId || "",
      name: f.name || "",
      parentId: f.parentId,
      messageCount: f.messageCount || 0,
      children: (f.children || []).map(mapFolder),
    });

    return { ok: true, data: (result || []).map(mapFolder) };
  } catch (err) {
    return makeError(
      `Ordner konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Retrieves a paginated list of messages in a folder.
 */
export async function beaGetMessages(
  session: BeaSession,
  safeId: string,
  folderId: string,
  options?: { offset?: number; limit?: number }
): Promise<BeaResult<BeaMessageSummary[]>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const result = await api.getMessages(
      session.sessionKeys,
      safeId,
      folderId,
      options?.offset ?? 0,
      options?.limit ?? 50
    );
    touchSession(session);

    const messages: BeaMessageSummary[] = (result || []).map((m: any) => ({
      id: m.id || "",
      nachrichtenId: m.nachrichtenId || m.messageId || "",
      betreff: m.betreff || m.subject || "",
      absender: m.absender || m.sender || "",
      absenderSafeId: m.absenderSafeId || m.senderSafeId || "",
      empfaenger: m.empfaenger || m.recipient || "",
      empfaengerSafeId: m.empfaengerSafeId || m.recipientSafeId || "",
      datum: m.datum || m.date || "",
      gelesen: m.gelesen ?? m.read ?? false,
      hasAttachments: m.hasAttachments ?? false,
      eebErforderlich: m.eebErforderlich ?? m.eebRequired ?? false,
    }));

    return { ok: true, data: messages };
  } catch (err) {
    return makeError(
      `Nachrichten konnten nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Retrieves a single message with decrypted content and attachments.
 */
export async function beaGetMessage(
  session: BeaSession,
  messageId: string
): Promise<BeaResult<BeaMessageDetail>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const m = await api.getMessage(session.sessionKeys, messageId);
    touchSession(session);

    if (!m) {
      return makeError("Nachricht nicht gefunden", "API_ERROR");
    }

    const detail: BeaMessageDetail = {
      id: m.id || "",
      nachrichtenId: m.nachrichtenId || m.messageId || "",
      betreff: m.betreff || m.subject || "",
      absender: m.absender || m.sender || "",
      absenderSafeId: m.absenderSafeId || m.senderSafeId || "",
      empfaenger: m.empfaenger || m.recipient || "",
      empfaengerSafeId: m.empfaengerSafeId || m.recipientSafeId || "",
      datum: m.datum || m.date || "",
      gelesen: m.gelesen ?? m.read ?? true,
      hasAttachments: !!(m.anhaenge || m.attachments)?.length,
      eebErforderlich: m.eebErforderlich ?? m.eebRequired ?? false,
      inhalt: m.inhalt || m.content || "",
      anhaenge: (m.anhaenge || m.attachments || []).map((a: any) => ({
        id: a.id || "",
        name: a.name || a.filename || "",
        mimeType: a.mimeType || a.contentType || "application/octet-stream",
        size: a.size || 0,
        content: a.content,
      })),
      pruefprotokoll: m.pruefprotokoll,
      xjustizXml: m.xjustizXml,
    };

    return { ok: true, data: detail };
  } catch (err) {
    return makeError(
      `Nachricht konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Sends a beA message to the specified recipient.
 */
export async function beaSendMessage(
  session: BeaSession,
  payload: BeaSendPayload
): Promise<BeaResult<{ nachrichtenId: string }>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const result = await api.sendMessage(session.sessionKeys, {
      recipientSafeId: payload.recipientSafeId,
      subject: payload.subject,
      body: payload.body,
      attachments: payload.attachments,
    });
    touchSession(session);

    return {
      ok: true,
      data: { nachrichtenId: result?.nachrichtenId || result?.messageId || "" },
    };
  } catch (err) {
    return makeError(
      `Nachricht konnte nicht gesendet werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Sends an electronic acknowledgment of receipt (eEB) for a message.
 */
export async function beaSendEeb(
  session: BeaSession,
  messageId: string,
  date: Date
): Promise<BeaResult<{ success: boolean }>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    await api.eEBanswer(session.sessionKeys, messageId, date.toISOString());
    touchSession(session);

    return { ok: true, data: { success: true } };
  } catch (err) {
    return makeError(
      `eEB konnte nicht gesendet werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Retrieves the verification protocol (Pruefprotokoll) for a message.
 */
export async function beaGetPruefprotokoll(
  session: BeaSession,
  messageId: string
): Promise<BeaResult<BeaPruefprotokoll>> {
  if (!isSessionValid(session)) {
    return makeError("Sitzung abgelaufen. Bitte erneut anmelden.", "SESSION_EXPIRED");
  }

  try {
    const lib = await loadBeaExpertLib();
    if (!lib) return makeError(beaLibError || "beA-Bibliothek nicht verfuegbar");

    const api = lib as any;
    const result = await api.getPruefprotokoll(session.sessionKeys, messageId);
    touchSession(session);

    if (!result) {
      return makeError("Pruefprotokoll nicht verfuegbar", "API_ERROR");
    }

    const protokoll: BeaPruefprotokoll = {
      ergebnis: result.ergebnis || result.result || "UNBEKANNT",
      zeitpunkt: result.zeitpunkt || result.timestamp || new Date().toISOString(),
      details: (result.details || result.checks || []).map((d: any) => ({
        pruefung: d.pruefung || d.check || "",
        ergebnis: d.ergebnis || d.result || "",
        hinweis: d.hinweis || d.hint,
      })),
    };

    return { ok: true, data: protokoll };
  } catch (err) {
    return makeError(
      `Pruefprotokoll konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
      "API_ERROR"
    );
  }
}

/**
 * Resets the library loading state (useful for retry after configuration change).
 */
export function resetBeaLib(): void {
  beaLib = null;
  beaLibError = null;
  beaLibLoading = false;
}
