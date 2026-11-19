/**
 * Datenschutz-Schleuse for agentic Helena runs (tools, multi-step).
 *
 * Every text entering the model context (Akte content, tool results, user
 * instructions) passes `einlassen()`: anonymised by anymize, mapping kept
 * locally. Tool arguments coming from the model pass `rueckfuehren()` locally
 * before a tool runs. The egress guard sits at the network layer
 * (`geschuetzterFetch`): every request to the LLM endpoint is checked as a
 * whole (all messages, tool arguments, tool results) and blocked on a finding.
 */

import { AnymizeClient } from "./anymize-client";
import { PiiGuard } from "./pii-guard";
import { bereinigeOriginal, lokaleRueckfuehrung } from "./rueckfuehrung";
import { PipelineFehler, type HashPaar, type PiiFinding, type ZusatzPruefer } from "./types";

export interface SchleusenStatistik {
  anymizeJobs: number;
  anymizeMs: number[];
  geprueftAnfragen: number;
  blockiert: number;
}

export class DatenschutzSchleuse {
  private readonly paare: HashPaar[] = [];
  private readonly rohtexte: string[] = [];
  private readonly jobIds: string[] = [];
  /** raw text -> anonymised text (the same system prompt or tool result is sent to anymize once). */
  private readonly cache = new Map<string, Promise<string>>();
  readonly statistik: SchleusenStatistik = { anymizeJobs: 0, anymizeMs: [], geprueftAnfragen: 0, blockiert: 0 };
  /** Placeholders anymize assigned per original value, to measure consistency across jobs. */
  readonly platzhalterJeWert = new Map<string, Set<string>>();

  constructor(
    private readonly anymize: AnymizeClient,
    private readonly o: { bekannteWerte?: string[]; erlaubteWerte?: string[]; zusatzPruefer?: ZusatzPruefer; jobsSofortLoeschen?: boolean } = {},
  ) {}

  /** Anonymises text before it may enter the model context (cached per run). */
  einlassen(text: string): Promise<string> {
    if (!text.trim()) return Promise.resolve(text);
    const vorhanden = this.cache.get(text);
    if (vorhanden) return vorhanden;
    const p = this.anonymisiere(text);
    this.cache.set(text, p);
    p.catch(() => this.cache.delete(text));
    return p;
  }

  private async anonymisiere(text: string): Promise<string> {
    const t0 = performance.now();
    const r = await this.anymize.anonymisiere(text);
    this.statistik.anymizeMs.push(Math.round(performance.now() - t0));
    this.statistik.anymizeJobs += r.jobIds.length;
    this.rohtexte.push(text);
    for (const p of r.paare) {
      this.paare.push(p);
      const s = this.platzhalterJeWert.get(p.original) ?? new Set<string>();
      s.add(p.placeholder);
      this.platzhalterJeWert.set(p.original, s);
    }
    // Raw text stays at anymize only as long as needed: delete every job right away,
    // also those without findings (they still hold the clear text).
    if (this.o.jobsSofortLoeschen !== false) {
      for (const id of r.jobIds) await this.anymize.loescheJob(id).catch(() => this.jobIds.push(id));
    } else this.jobIds.push(...r.jobIds);
    return r.text;
  }

  /**
   * Known original values -> placeholders, locally. For text the model itself
   * produced (it only ever saw placeholders, re-identified afterwards).
   */
  lokalPseudonymisieren(text: string): string {
    let out = text;
    const sortiert = this.paare
      .map((p) => ({ original: bereinigeOriginal(p.original), placeholder: p.placeholder }))
      .filter((p) => p.original.length >= 2)
      .sort((a, b) => b.original.length - a.original.length);
    for (const p of sortiert) out = out.split(p.original).join(p.placeholder);
    return out;
  }

  /** Placeholders -> original values, locally (tool arguments, final result). */
  rueckfuehren(text: string, json = false): { text: string; offen: number } {
    const r = lokaleRueckfuehrung(text, this.paare, json);
    return { text: r.text, offen: r.offen };
  }

  /** Checks an outgoing payload against everything the Schleuse has seen. */
  async pruefe(ausgehend: string): Promise<PiiFinding[]> {
    const guard = new PiiGuard({
      originalText: this.rohtexte.join("\n"),
      paare: this.paare,
      bekannteWerte: this.o.bekannteWerte,
      erlaubteWerte: this.o.erlaubteWerte,
      zusatzPruefer: this.o.zusatzPruefer,
    });
    return guard.pruefe(ausgehend);
  }

  /**
   * fetch for the LLM provider: checks every request body (all strings in the
   * JSON, i.e. messages, tool calls, tool results) before it leaves; blocks on findings.
   */
  geschuetzterFetch(basis: typeof fetch = fetch, bodyAnpassen?: (body: Record<string, unknown>) => void): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body && typeof init.body === "string") {
        let body: Record<string, unknown> | null = null;
        try {
          body = JSON.parse(init.body);
        } catch {
          body = null;
        }
        if (!body) throw new PipelineFehler("guard", "UNPRUEFBAR", "Anfrage an die KI ist nicht prüfbar und wurde gestoppt");
        const texte = sammleStrings(body).join("\n");
        this.statistik.geprueftAnfragen++;
        const funde = await this.pruefe(texte);
        if (funde.length > 0) {
          this.statistik.blockiert++;
          throw new PipelineFehler(
            "guard",
            "PII_IM_AUSGANG",
            `Versand gestoppt: ${funde.length} personenbezogene Angabe(n) in der Anfrage an die KI (${funde.map((f) => `${f.kategorie} ${f.maske}`).join("; ")})`,
          );
        }
        if (bodyAnpassen) {
          bodyAnpassen(body);
          init = { ...init, body: JSON.stringify(body) };
        }
      }
      return basis(input, init);
    }) as typeof fetch;
  }

  /** Deletes jobs that were kept or whose deletion failed. */
  async aufraeumen(): Promise<boolean> {
    const rest: string[] = [];
    for (const id of this.jobIds) await this.anymize.loescheJob(id).catch(() => rest.push(id));
    this.jobIds.length = 0;
    this.jobIds.push(...rest);
    return rest.length === 0;
  }
}

function sammleStrings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(sammleStrings);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).flatMap(sammleStrings);
  return [];
}
