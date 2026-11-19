/**
 * Helena Datei-Pipeline (Cowork-style file processing, privacy first).
 *
 *   1 Einlesen       validate size/format, file names stay internal
 *   2 Konvertieren   local, in-memory, to Markdown (OCR only via local provider)
 *   3 Anonymisieren  anymize /api/anonymize (instruction + documents together)
 *   4 Guard          local egress check of the exact LLM payload, fail closed
 *   5 Verarbeiten    LLM sees placeholders only; provider location policy
 *   6 Rückführung    local, from hash pairs (no PII sent again)
 *   7 Aufräumen      delete anymize jobs (incl. hash pairs), zero input buffers
 *
 * Fail closed everywhere: if any step fails, nothing is sent to the LLM.
 * Logs contain the protocol only (counts, codes, masked findings), never text
 * or file names.
 */

import { randomUUID } from "node:crypto";
import { AnymizeClient, AnymizeFehler } from "./anymize-client";
import { zuMarkdown } from "./konvertieren";
import { PiiGuard } from "./pii-guard";
import { lokaleRueckfuehrung } from "./rueckfuehrung";
import {
  systemPromptFuer,
  baueNutzerPrompt,
  type Verarbeiter,
} from "./verarbeiter";
import {
  PipelineFehler,
  type EingangsDatei,
  type HashPaar,
  type OcrProvider,
  type PipelineErgebnis,
  type PipelineProtokoll,
  type PipelineSchritt,
  type ZusatzPruefer,
} from "./types";

export const DOKUMENT_TRENNER = "=== HELENA DOKUMENTGRENZE 7F3A ===";
export const MAX_DATEIEN = 10;

export interface SicheresLog {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

export interface PipelineOptionen {
  dateien: EingangsDatei[];
  auftrag: string;
  anymize: AnymizeClient;
  verarbeiter: Verarbeiter;
  ocr?: OcrProvider;
  bekannteWerte?: string[];
  erlaubteWerte?: string[];
  zusatzPruefer?: ZusatzPruefer;
  /** Allow server-side reverse mapping when no hash pairs are available (ZDR off but pairs missing). */
  serverRueckfuehrung?: boolean;
  /** Zero the input buffers after conversion (default true). */
  rohdatenNullen?: boolean;
  systemPrompt?: string;
  /** Task type (see modelle.ts); selects the task-specific prompt addition. */
  aufgabe?: string;
  /** Notes from model selection etc., copied into the protocol. */
  zusatzHinweise?: string[];
  log?: SicheresLog;
}

export async function verarbeiteDateien(o: PipelineOptionen): Promise<PipelineErgebnis> {
  const protokoll: PipelineProtokoll = {
    laufId: randomUUID(),
    format: null,
    bytes: o.dateien.reduce((s, d) => s + d.daten.length, 0),
    zeichenMarkdown: 0,
    ocr: false,
    anymizeJobs: 0,
    ersetzungen: 0,
    guardOk: false,
    guardFunde: [],
    anymizeJobsGeloescht: true,
    offenePlatzhalter: 0,
    verarbeiter: o.verarbeiter.name,
    aufgabe: o.aufgabe,
    dauerMs: {},
    hinweise: [...(o.zusatzHinweise ?? [])],
  };
  const offeneJobs = new Set<string>();
  let schritt: PipelineSchritt = "einlesen";
  const uhr = (name: string, t0: number) => (protokoll.dauerMs[name] = Math.round(performance.now() - t0));

  try {
    // -- 1 Input checks before anything leaves the process ---------------------
    if (o.dateien.length === 0) throw new PipelineFehler("einlesen", "KEINE_DATEI", "Keine Datei übergeben");
    if (o.dateien.length > MAX_DATEIEN) throw new PipelineFehler("einlesen", "ZU_VIELE_DATEIEN", `Höchstens ${MAX_DATEIEN} Dateien je Auftrag`);
    if (!o.auftrag.trim()) throw new PipelineFehler("einlesen", "KEIN_AUFTRAG", "Kein Auftrag angegeben");

    // -- 2 Konvertieren ---------------------------------------------------------
    schritt = "konvertieren";
    let t0 = performance.now();
    const teile: string[] = [];
    try {
      for (const [i, d] of o.dateien.entries()) {
        const k = await zuMarkdown(d, { ocr: o.ocr });
        protokoll.format = protokoll.format ?? k.format;
        protokoll.ocr ||= k.ocr;
        protokoll.hinweise.push(...k.hinweise.map((h) => (o.dateien.length > 1 ? `Dokument ${i + 1}: ${h}` : h)));
        // File names are personal data ("Kündigung Müller.docx") and are not passed on.
        teile.push(o.dateien.length > 1 ? `## Dokument ${i + 1} von ${o.dateien.length} (${k.format.toUpperCase()})\n\n${k.markdown}` : k.markdown);
      }
    } finally {
      if (o.rohdatenNullen !== false) for (const d of o.dateien) d.daten.fill(0);
    }
    const dokument = teile.join("\n\n");
    protokoll.zeichenMarkdown = dokument.length;
    uhr("konvertieren", t0);

    // -- 3 Anonymisieren ----------------------------------------------------------
    schritt = "anonymisieren";
    t0 = performance.now();
    let auftragAnonym: string;
    let dokumentAnonym: string;
    let paare: HashPaar[];
    const merkeJobs = (ids: string[] | undefined) => ids?.forEach((id) => offeneJobs.add(id));
    try {
      const r = await o.anymize.anonymisiere(`${o.auftrag.trim()}\n\n${DOKUMENT_TRENNER}\n\n${dokument}`);
      merkeJobs(r.jobIds);
      paare = r.paare;
      const pos = r.text.indexOf(DOKUMENT_TRENNER);
      if (pos >= 0 && r.text.indexOf(DOKUMENT_TRENNER, pos + 1) < 0) {
        auftragAnonym = r.text.slice(0, pos).trim();
        dokumentAnonym = r.text.slice(pos + DOKUMENT_TRENNER.length).trim();
      } else {
        // Separator altered by anonymisation: fall back to two separate jobs.
        protokoll.hinweise.push("Auftrag und Dokument wurden getrennt anonymisiert");
        const a = await o.anymize.anonymisiere(o.auftrag.trim());
        merkeJobs(a.jobIds);
        const d = await o.anymize.anonymisiere(dokument);
        merkeJobs(d.jobIds);
        auftragAnonym = a.text;
        dokumentAnonym = d.text;
        paare = [...a.paare, ...d.paare];
      }
    } catch (e) {
      merkeJobs((e as { jobIds?: string[] }).jobIds);
      throw e;
    }
    protokoll.anymizeJobs = offeneJobs.size;
    protokoll.ersetzungen = paare.length;
    if (paare.length === 0) {
      protokoll.hinweise.push(
        "anymize lieferte keine Zuordnungstabelle (Zero Data Retention aktiv oder keine Personendaten erkannt)",
      );
    }
    uhr("anonymisieren", t0);

    // Data minimisation: once the mapping is local, anymize no longer needs it.
    if (paare.length > 0 || !o.serverRueckfuehrung) {
      schritt = "aufraeumen";
      await loescheJobs(o.anymize, offeneJobs, protokoll);
    }

    // -- 4 Guard ------------------------------------------------------------------
    schritt = "guard";
    t0 = performance.now();
    const system = o.systemPrompt ?? systemPromptFuer(o.aufgabe);
    const nutzer = baueNutzerPrompt(auftragAnonym, dokumentAnonym);
    const guard = new PiiGuard({
      originalText: `${o.auftrag}\n${dokument}`,
      paare,
      bekannteWerte: o.bekannteWerte,
      erlaubteWerte: o.erlaubteWerte,
      zusatzPruefer: o.zusatzPruefer,
    });
    let funde;
    try {
      funde = await guard.pruefe(`${system}\n${nutzer}`);
    } catch {
      throw new PipelineFehler("guard", "PRUEFER_FEHLER", "Die lokale Zusatzprüfung ist fehlgeschlagen");
    }
    uhr("guard", t0);
    if (funde.length > 0) {
      protokoll.guardFunde = funde.map(({ kategorie, maske }) => ({ kategorie, maske }));
      throw new PipelineFehler(
        "guard",
        "PII_IM_AUSGANG",
        `Versand gestoppt: ${funde.length} personenbezogene Angabe(n) wurden nicht anonymisiert`,
      );
    }
    protokoll.guardOk = true;

    // -- 5 Verarbeiten --------------------------------------------------------------
    schritt = "verarbeiten";
    t0 = performance.now();
    let antwort: string;
    try {
      const a = await o.verarbeiter.verarbeite({ system, nutzer, aufgabe: o.aufgabe });
      if (typeof a === "string") antwort = a;
      else {
        antwort = a.text;
        protokoll.nutzung = { tokensEin: a.tokensEin, tokensAus: a.tokensAus, credits: a.credits };
      }
    } catch (e) {
      // Only status code / error class: provider error bodies may echo the prompt.
      const status = (e as { statusCode?: unknown })?.statusCode;
      // KiAufrufFehler messages are fixed strings without content; other errors only by class.
      const art = e instanceof Error ? (e.name === "KiAufrufFehler" ? e.message : e.name.replace(/[^A-Za-z]/g, "").slice(0, 40)) : "Unbekannt";
      protokoll.hinweise.push(`KI-Fehler: ${art}${typeof status === "number" && e instanceof Error && e.name !== "KiAufrufFehler" ? ` (HTTP ${status})` : ""}`);
      throw new PipelineFehler("verarbeiten", "KI_FEHLER", "Die KI-Verarbeitung ist fehlgeschlagen");
    }
    uhr("verarbeiten", t0);

    // -- 6 Rückführung --------------------------------------------------------------
    schritt = "rueckfuehrung";
    t0 = performance.now();
    let ergebnis: string;
    if (paare.length > 0) {
      const r = lokaleRueckfuehrung(antwort, paare);
      ergebnis = r.text;
      protokoll.offenePlatzhalter = r.offen;
    } else if (o.serverRueckfuehrung && offeneJobs.size > 0) {
      ergebnis = await o.anymize.deanonymisiere(antwort);
      protokoll.offenePlatzhalter = lokaleRueckfuehrung(ergebnis, []).offen;
    } else {
      ergebnis = antwort;
      protokoll.offenePlatzhalter = lokaleRueckfuehrung(antwort, []).offen;
    }
    if (protokoll.offenePlatzhalter > 0) {
      protokoll.hinweise.push(`${protokoll.offenePlatzhalter} Platzhalter konnten nicht zurückgeführt werden, bitte manuell prüfen`);
    }
    uhr("rueckfuehrung", t0);

    return { ergebnis, ergebnisAnonymisiert: antwort, protokoll };
  } catch (e) {
    const f = alsPipelineFehler(e, schritt);
    protokoll.fehler = { schritt: f.schritt, code: f.code };
    throw new PipelineFehler(f.schritt, f.code, f.message, protokoll);
  } finally {
    if (offeneJobs.size > 0) await loescheJobs(o.anymize, offeneJobs, protokoll);
    if (!protokoll.anymizeJobsGeloescht) {
      protokoll.hinweise.push("anymize-Job(s) konnten nicht gelöscht werden, Löschung nachholen (siehe Betriebshandbuch)");
    }
    o.log?.[protokoll.fehler ? "warn" : "info"]({ helenaDateiPipeline: protokoll }, protokoll.fehler ? "Datei-Pipeline abgebrochen" : "Datei-Pipeline abgeschlossen");
  }
}

async function loescheJobs(client: AnymizeClient, jobs: Set<string>, protokoll: PipelineProtokoll) {
  for (const id of [...jobs]) {
    try {
      await client.loescheJob(id);
      jobs.delete(id);
    } catch {
      // stays in the set; reported below
    }
  }
  protokoll.anymizeJobsGeloescht = jobs.size === 0;
  // Job ids carry no personal data; operations needs them to repeat the deletion.
  protokoll.nichtGeloeschteJobs = jobs.size > 0 ? [...jobs] : undefined;
}

function alsPipelineFehler(e: unknown, schritt: PipelineSchritt): PipelineFehler {
  if (e instanceof PipelineFehler) return e;
  if (e instanceof AnymizeFehler) return new PipelineFehler(schritt, `ANYMIZE_${e.code}`, e.message);
  return new PipelineFehler(schritt, "INTERNER_FEHLER", "Interner Fehler in der Datei-Pipeline");
}
