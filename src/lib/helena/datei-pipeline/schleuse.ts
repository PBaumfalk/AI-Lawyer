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

import { createHash } from "node:crypto";
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
  ) {
    // An allowed term that is part of a Beteiligter's name (a Mandantin called Helena)
    // is not allowed for this Akte.
    this.namensteile = new Set((o.bekannteWerte ?? []).flatMap((w) => w.toLowerCase().split(/[\s,-]+/)));
    this.erlaubt = (o.erlaubteWerte ?? []).filter((b) => !this.namensteile.has(b.toLowerCase()));
    // Known values from the database (Beteiligte, staff) are replaced locally and
    // deterministically before anything goes to anymize: anymize misses e.g. a first
    // name standing alone in a JSON field (observed live 2026-11-19).
    for (const w of new Set((o.bekannteWerte ?? []).map((x) => x.trim()).filter((x) => x.length >= 3))) {
      if (this.istErlaubt(w)) continue;
      const typ = /@/.test(w) ? "email" : /^[A-Z]{2}\d{2}/.test(w.replace(/\s/g, "")) ? "iban" : /\d/.test(w) ? "angabe" : "person";
      this.paare.push({ original: w, placeholder: `[[${typ}-L${createHash("sha256").update(w).digest("hex").slice(0, 5).toUpperCase()}]]` });
    }
  }

  /**
   * Not personal data: allowed terms (incl. technical constants registered from
   * code-defined tool and schema definitions) and internal database ids (cuid).
   */
  private istErlaubt(wert: string): boolean {
    const w = bereinigeOriginal(wert);
    return /^c[a-z0-9]{20,30}$/.test(w) || this.erlaubt.some((b) => b.toLowerCase() === w.toLowerCase());
  }

  /**
   * Registers terms from code-defined parts of a request (tool definitions, JSON
   * schema), e.g. enum values like ERSTINSTANZ that anymize tags (live 2026-11-19).
   * Terms that are part of a Beteiligter's name are never allowed.
   */
  erlaubeBegriffe(begriffe: Iterable<string>): void {
    for (const b of begriffe) {
      if (!this.namensteile.has(b.toLowerCase()) && !this.erlaubt.includes(b)) this.erlaubt.push(b);
    }
  }

  private readonly erlaubt: string[];
  private readonly namensteile: Set<string>;

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
    // First layer: local replacement of everything already known.
    const r = await this.anymize.anonymisiere(this.lokalPseudonymisieren(text));
    this.statistik.anymizeMs.push(Math.round(performance.now() - t0));
    this.statistik.anymizeJobs += r.jobIds.length;
    this.rohtexte.push(text);
    let ergebnis = r.text;
    for (const p of r.paare) {
      // anymize treats generic words like "Helena" or "Kanzlei" as names (observed live
      // 2026-11-19). Allowed terms are put back and are not personal values.
      if (this.istErlaubt(p.original)) {
        ergebnis = ergebnis.split(p.placeholder).join(bereinigeOriginal(p.original));
        continue;
      }
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
    return ergebnis;
  }

  /**
   * Known original values -> placeholders, locally. For text the model itself
   * produced (it only ever saw placeholders, re-identified afterwards).
   */
  lokalPseudonymisieren(text: string): string {
    let out = text;
    const sortiert = this.paare
      .map((p) => ({ original: bereinigeOriginal(p.original), placeholder: p.placeholder }))
      .filter((p) => p.original.length >= 3)
      .sort((a, b) => b.original.length - a.original.length);
    for (const p of sortiert) {
      // Whole words only. Whitespace inside a value may be any whitespace run or a
      // JSON escape (\n, \r, \t): tool results arrive as JSON strings (observed live 2026-11-19).
      const muster = p.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "(?:\\s|\\\\[nrt])+");
      out = out.replace(
        new RegExp(`(?:(?<=\\\\[nrt])|(?<![\\p{L}\\p{N}]))${muster}(?![\\p{L}\\p{N}])`, "gu"),
        p.placeholder,
      );
    }
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
      erlaubteWerte: this.erlaubt,
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
