/**
 * Minimal anymize REST client, built strictly from the public API docs
 * (https://anymize.ai/api-docs, read 2026-11-19):
 *
 *   POST   /api/anonymize               {text, language} -> 202 {job_id, status, zdr}
 *   GET    /api/status/{jobId}          -> {status, anonymized_text_raw, ...}
 *   GET    /api/status/{jobId}/strings  -> {hash_pairs: [{original, placeholder, ...}]}
 *   POST   /api/deanonymize             {text} -> {text, replacements}
 *   DELETE /api/v1/jobs/{jobId}         deletes job incl. all hash pairs
 *
 * Auth: "Authorization: Bearer <key>". Polling: start 2 s, max 30 s.
 * 429/5xx: retry with backoff, 4xx: do not retry.
 *
 * Privacy rules for this file:
 * - Error messages never include response bodies (they may echo document text).
 * - The `original_text` field of the status response is ignored and never kept.
 */

import type { AnonymisierungsErgebnis, HashPaar } from "./types";

export const ANYMIZE_DEFAULT_BASE_URL = "https://app.anymize.ai";

export class AnymizeFehler extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number | null,
    message: string,
  ) {
    super(message);
    this.name = "AnymizeFehler";
  }
}

export interface AnymizeClientOptionen {
  apiKey: string;
  baseUrl?: string;
  sprache?: string;
  /** Max. total wait for one job. */
  jobTimeoutMs?: number;
  /** Max. characters per anonymisation job; longer texts are split at paragraphs. */
  maxZeichenProJob?: number;
  fetchImpl?: typeof fetch;
  schlafen?: (ms: number) => Promise<void>;
  /** Per-request timeout. */
  requestTimeoutMs?: number;
}

const realSchlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class AnymizeClient {
  private readonly basis: string;
  private readonly f: typeof fetch;
  private readonly schlafen: (ms: number) => Promise<void>;

  constructor(private readonly o: AnymizeClientOptionen) {
    if (!o.apiKey) throw new AnymizeFehler("KEIN_API_KEY", null, "Kein anymize-API-Schlüssel hinterlegt");
    this.basis = (o.baseUrl ?? ANYMIZE_DEFAULT_BASE_URL).replace(/\/+$/, "");
    if (!/^https:\/\//.test(this.basis) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(this.basis)) {
      throw new AnymizeFehler("UNSICHERE_URL", null, "anymize-URL muss HTTPS verwenden");
    }
    this.f = o.fetchImpl ?? fetch;
    this.schlafen = o.schlafen ?? realSchlafen;
  }

  /** URL prefixes that may receive raw (not yet anonymised) text. Used by the egress recorder in tests. */
  get rohdatenEndpunkte(): string[] {
    return [`${this.basis}/api/anonymize`];
  }

  // -------------------------------------------------------------------------

  private async anfrage(
    methode: "GET" | "POST" | "DELETE",
    pfad: string,
    body?: unknown,
    { wiederholen = true }: { wiederholen?: boolean } = {},
  ): Promise<{ status: number; json: unknown }> {
    let versuch = 0;
    for (;;) {
      versuch++;
      let res: Response;
      try {
        res = await this.f(`${this.basis}${pfad}`, {
          method: methode,
          headers: {
            Authorization: `Bearer ${this.o.apiKey}`,
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            Accept: "application/json",
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.o.requestTimeoutMs ?? 60_000),
          redirect: "error",
        });
      } catch {
        if (wiederholen && versuch < 3) {
          await this.schlafen(1000 * 2 ** versuch);
          continue;
        }
        throw new AnymizeFehler("NETZWERK", null, "anymize nicht erreichbar");
      }

      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        await res.body?.cancel().catch(() => {});
        if (versuch < 4) {
          await this.schlafen(wartezeit(res.headers.get("retry-after"), versuch));
          continue;
        }
        throw new AnymizeFehler(res.status === 429 ? "RATE_LIMIT" : "NICHT_VERFUEGBAR", res.status, `anymize antwortet mit HTTP ${res.status}`);
      }

      let json: unknown = null;
      const text = await res.text().catch(() => "");
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        const code = fehlerCode(json) ?? `HTTP_${res.status}`;
        throw new AnymizeFehler(code, res.status, `anymize-Fehler ${res.status} (${code})`);
      }
      return { status: res.status, json };
    }
  }

  // -------------------------------------------------------------------------

  /** Anonymises text. Long texts are split into several jobs. */
  async anonymisiere(text: string): Promise<AnonymisierungsErgebnis> {
    const stuecke = teileText(text, this.o.maxZeichenProJob ?? 100_000);
    const ergebnis: AnonymisierungsErgebnis = { jobIds: [], text: "", paare: [] };
    try {
      for (const stueck of stuecke) {
        const r = await this.anonymisiereEinzeln(stueck, ergebnis.jobIds);
        ergebnis.text += r.text;
        ergebnis.paare.push(...r.paare);
      }
    } catch (e) {
      // Hand already created job ids to the caller so it can delete them.
      (e as { jobIds?: string[] }).jobIds = [...ergebnis.jobIds];
      throw e;
    }
    return ergebnis;
  }

  private async anonymisiereEinzeln(text: string, jobIds: string[]): Promise<{ text: string; paare: HashPaar[] }> {
    // POST is retried only on 429/503 (no job created). A network error after
    // sending is not retried, so we never create untracked duplicate jobs.
    const start = await this.anfrage("POST", "/api/anonymize", { text, language: this.o.sprache ?? "de" }, { wiederholen: false });
    const j = start.json as { job_id?: string; zdr?: boolean } | null;
    if (!j?.job_id || typeof j.job_id !== "string") {
      throw new AnymizeFehler("UNERWARTETE_ANTWORT", start.status, "anymize lieferte keine Job-ID");
    }
    jobIds.push(j.job_id);
    const jobId = encodeURIComponent(j.job_id);

    const frist = Date.now() + (this.o.jobTimeoutMs ?? 5 * 60_000);
    let warte = 2000;
    let anonymisiert: string | null = null;
    for (;;) {
      await this.schlafen(warte);
      const s = await this.anfrage("GET", `/api/status/${jobId}`);
      const st = s.json as { status?: string; anonymized_text_raw?: unknown } | null;
      if (st?.status === "completed") {
        if (typeof st.anonymized_text_raw !== "string") {
          throw new AnymizeFehler("UNERWARTETE_ANTWORT", s.status, "anymize lieferte keinen anonymisierten Text");
        }
        anonymisiert = st.anonymized_text_raw;
        break;
      }
      if (st?.status === "failed" || st?.status === "error") {
        throw new AnymizeFehler("JOB_FEHLGESCHLAGEN", s.status, "anymize-Job fehlgeschlagen");
      }
      // Live, anymize reports undocumented intermediate states (e.g. "pass1_extracting").
      // Any other string counts as "still running"; the deadline below still applies.
      if (typeof st?.status !== "string") {
        throw new AnymizeFehler("UNERWARTETE_ANTWORT", s.status, "Unbekannte Statusantwort von anymize");
      }
      if (Date.now() > frist) throw new AnymizeFehler("ZEITUEBERSCHREITUNG", null, "anymize-Job dauert zu lange");
      warte = Math.min(30_000, Math.round(warte * 1.5));
    }

    // Hash pairs: empty when Zero Data Retention is active on the account.
    let paare: HashPaar[] = [];
    try {
      const p = await this.anfrage("GET", `/api/status/${jobId}/strings`);
      const hp = (p.json as { hash_pairs?: unknown } | null)?.hash_pairs;
      if (Array.isArray(hp)) {
        paare = hp
          .filter((x): x is HashPaar => !!x && typeof (x as HashPaar).original === "string" && typeof (x as HashPaar).placeholder === "string")
          .map((x) => ({ original: x.original, placeholder: x.placeholder, prefix_name: x.prefix_name, hash: x.hash }));
      }
    } catch (e) {
      if (!(e instanceof AnymizeFehler && e.httpStatus === 404)) throw e;
    }
    return { text: anonymisiert, paare };
  }

  /** Server-side reverse mapping. Only sends text that already contains placeholders. */
  async deanonymisiere(text: string): Promise<string> {
    const r = await this.anfrage("POST", "/api/deanonymize", { text });
    const t = (r.json as { text?: unknown } | null)?.text;
    if (typeof t !== "string") throw new AnymizeFehler("UNERWARTETE_ANTWORT", r.status, "anymize lieferte keinen Text");
    return t;
  }

  /** Deletes a job including all hash pairs (irreversible). 404 counts as deleted. */
  async loescheJob(jobId: string): Promise<void> {
    try {
      await this.anfrage("DELETE", `/api/v1/jobs/${encodeURIComponent(jobId)}`);
    } catch (e) {
      if (e instanceof AnymizeFehler && e.httpStatus === 404) return;
      throw e;
    }
  }
}

function fehlerCode(json: unknown): string | null {
  const e = (json as { error?: unknown } | null)?.error;
  if (e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string") {
    return String((e as { code: string }).code).replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
  }
  return null;
}

/** Retry-After is documented both as seconds and as unix timestamp; accept both. */
export function wartezeit(header: string | null, versuch: number): number {
  const n = header ? Number(header) : NaN;
  if (Number.isFinite(n) && n > 0) {
    const ms = n > 1_000_000_000 ? n * 1000 - Date.now() : n * 1000;
    return Math.min(60_000, Math.max(1000, ms));
  }
  return Math.min(30_000, 2000 * 2 ** (versuch - 1));
}

/** Splits at paragraph boundaries; a single huge paragraph is split hard. */
export function teileText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const teile: string[] = [];
  let aktuell = "";
  for (const absatz of text.split(/(?<=\n\n)/)) {
    if (aktuell.length + absatz.length > max && aktuell) {
      teile.push(aktuell);
      aktuell = "";
    }
    if (absatz.length > max) {
      // Never cut inside a word: a name split in two halves would escape recognition.
      let rest = absatz;
      while (rest.length > max) {
        const fenster = rest.slice(0, max);
        const satz = Math.max(fenster.lastIndexOf(". "), fenster.lastIndexOf("\n"));
        const wort = fenster.lastIndexOf(" ");
        const schnitt = satz > max / 2 ? satz + 1 : wort > 0 ? wort + 1 : max;
        teile.push(rest.slice(0, schnitt));
        rest = rest.slice(schnitt);
      }
      aktuell = rest;
    } else aktuell += absatz;
  }
  if (aktuell) teile.push(aktuell);
  return teile;
}
