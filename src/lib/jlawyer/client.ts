import type {
  JLawyerCredentials,
  JLawyerCase,
  JLawyerCaseOverview,
  JLawyerCaseFolder,
  JLawyerContact,
  JLawyerContactOverview,
  JLawyerParty,
  JLawyerDocument,
  JLawyerDocumentContent,
  JLawyerDueDate,
  JLawyerUser,
  JLawyerDate,
} from "./types";
import { validateJLawyerBaseUrl } from "./validate-url";

/**
 * REST root of the j-lawyer server, appended when the configured URL has no
 * path (e.g. "https://jlawyer.kanzlei.de:8080").
 *
 * The endpoint catalogue only lists paths relative to the REST root
 * ("/v1/cases/list"); the root itself ("/j-lawyer-io/rest") comes from the
 * j-lawyer.org server layout (web module j-lawyer-io, JAX-RS path "rest").
 * Installations behind a reverse proxy can enter the full REST root as URL
 * (e.g. "https://proxy.kanzlei.de/jlawyer/j-lawyer-io/rest"); then it is used
 * unchanged.
 */
export const JLAWYER_DEFAULT_REST_ROOT = "/j-lawyer-io/rest";

/** j-lawyer REST paths used by the migration (relative to the REST root). */
export const JLAWYER_PATHS = {
  partyTypes: () => "/v1/cases/party/types",
  casesList: () => "/v1/cases/list",
  case: (id: string) => `/v2/cases/${enc(id)}`,
  caseParties: (id: string) => `/v1/cases/${enc(id)}/parties`,
  caseDueDates: (id: string) => `/v4/cases/${enc(id)}/duedates`,
  caseDocuments: (id: string) => `/v1/cases/${enc(id)}/documents`,
  caseFolders: (id: string) => `/v3/cases/${enc(id)}/folders`,
  documentContent: (docId: string) => `/v1/cases/document/${enc(docId)}/content`,
  contactsList: () => "/v1/contacts/list",
  contact: (id: string) => `/v2/contacts/${enc(id)}`,
  usersList: () => "/v6/security/users/list",
} as const;

function enc(id: string): string {
  return encodeURIComponent(id);
}

/** Resolve the configured server URL to the REST root (no trailing slash). */
export function resolveRestRoot(baseUrl: string): string {
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  const root = path === "" ? JLAWYER_DEFAULT_REST_ROOT : path;
  return `${url.origin}${root}`;
}

/**
 * Parse a j-lawyer date value. j-lawyer (Java) serialises zoned timestamps
 * as "2026-09-30T10:00:00Z[UTC]"; the "[Zone]" suffix is not understood by
 * the JS Date parser, so it is stripped (the offset before it is
 * authoritative). Epoch milliseconds are accepted as well.
 * Returns null for empty or unparseable values.
 */
export function parseJLawyerDate(value: JLawyerDate): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\[[^\]]*\]$/, "");
  // German free-text dates (contact birth dates): dd.MM.yyyy
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(cleaned);
  if (de) {
    const d = new Date(Date.UTC(Number(de[3]), Number(de[2]) - 1, Number(de[1])));
    return d.getUTCDate() === Number(de[1]) ? d : null;
  }
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class JLawyerClient {
  private restRoot: string;
  private authHeader: string;

  constructor(credentials: JLawyerCredentials) {
    // SSRF guard: only https + public hosts unless explicitly opted in
    const validation = validateJLawyerBaseUrl(credentials.baseUrl);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    this.restRoot = resolveRestRoot(credentials.baseUrl);
    this.authHeader =
      "Basic " +
      Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString("base64");
  }

  private readonly timeoutMs = 15000;
  private readonly maxRetries = 3;

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.ok) return res;
        const retryable = res.status >= 500 || res.status === 429;
        if (!retryable || attempt === this.maxRetries) return res;
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries) throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    throw lastError ?? new Error("J-Lawyer request failed");
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.restRoot}${path}`;
    const res = await this.fetchWithRetry(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
      // No cache -- always fetch fresh data during migration
      cache: "no-store",
    });
    if (!res.ok) {
      // Do not include the response body — error messages are reflected
      // back to API callers and a body could leak data fetched from an
      // attacker-chosen URL (SSRF credential-reflection).
      throw new Error(`J-Lawyer API error ${res.status} at ${path}`);
    }
    return res.json() as Promise<T>;
  }

  private async getList<T>(path: string): Promise<T[]> {
    const data = await this.get<unknown>(path);
    if (!Array.isArray(data)) {
      throw new Error(`J-Lawyer API: Liste erwartet bei ${path}`);
    }
    return data as T[];
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      // Small, read-only endpoint (configured party types)
      await this.getList(JLAWYER_PATHS.partyTypes());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  listCases(): Promise<JLawyerCaseOverview[]> {
    return this.getList<JLawyerCaseOverview>(JLAWYER_PATHS.casesList());
  }

  getCase(id: string): Promise<JLawyerCase> {
    return this.get<JLawyerCase>(JLAWYER_PATHS.case(id));
  }

  getCaseParties(caseId: string): Promise<JLawyerParty[]> {
    return this.getList<JLawyerParty>(JLAWYER_PATHS.caseParties(caseId));
  }

  getCaseDueDates(caseId: string): Promise<JLawyerDueDate[]> {
    return this.getList<JLawyerDueDate>(JLAWYER_PATHS.caseDueDates(caseId));
  }

  getCaseDocuments(caseId: string): Promise<JLawyerDocument[]> {
    return this.getList<JLawyerDocument>(JLAWYER_PATHS.caseDocuments(caseId));
  }

  getCaseFolders(caseId: string): Promise<JLawyerCaseFolder> {
    return this.get<JLawyerCaseFolder>(JLAWYER_PATHS.caseFolders(caseId));
  }

  /** Download a document; j-lawyer returns the content Base64-encoded in JSON. */
  async getDocumentContent(docId: string): Promise<{ fileName: string | null; buffer: Buffer }> {
    const data = await this.get<JLawyerDocumentContent>(JLAWYER_PATHS.documentContent(docId));
    if (typeof data?.base64content !== "string") {
      throw new Error(`J-Lawyer API: kein Dokumentinhalt für ${docId}`);
    }
    return {
      fileName: data.fileName ?? null,
      buffer: Buffer.from(data.base64content, "base64"),
    };
  }

  listContacts(): Promise<JLawyerContactOverview[]> {
    return this.getList<JLawyerContactOverview>(JLAWYER_PATHS.contactsList());
  }

  getContact(id: string): Promise<JLawyerContact> {
    return this.get<JLawyerContact>(JLAWYER_PATHS.contact(id));
  }

  listUsers(): Promise<JLawyerUser[]> {
    return this.getList<JLawyerUser>(JLAWYER_PATHS.usersList());
  }
}
