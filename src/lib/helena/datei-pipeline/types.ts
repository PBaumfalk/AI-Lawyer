/**
 * Helena Datei-Pipeline: shared types.
 *
 * Flow: Einlesen -> Konvertieren (lokal) -> Anonymisieren (anymize)
 *       -> Egress-Guard (lokal) -> Verarbeiten (LLM) -> Rückführung (lokal)
 *
 * Invariant: raw document content may only leave the process towards the
 * anymize anonymisation endpoint (Auftragsverarbeiter). Everything else that
 * leaves the process passes the PII egress guard first (fail closed).
 */

export type EingabeFormat =
  | "txt"
  | "md"
  | "csv"
  | "html"
  | "docx"
  | "odt"
  | "rtf"
  | "eml"
  | "pdf"
  | "bild";

export interface EingangsDatei {
  /** Raw bytes. Zeroed by the pipeline once no longer needed. */
  daten: Buffer;
  /** Original file name. Treated as personal data: never logged, never sent out. */
  dateiname: string;
  /** Declared MIME type (untrusted, cross-checked against magic bytes). */
  mimeType?: string;
}

export interface KonvertierungsErgebnis {
  format: EingabeFormat;
  markdown: string;
  /** True when text came from OCR (lower reliability, see protocol). */
  ocr: boolean;
  hinweise: string[];
}

/** Local OCR provider (e.g. Stirling-PDF in the own Docker network). */
export interface OcrProvider {
  /** Returns plain text for a PDF or image buffer. Must run on-premises. */
  texterkennung(daten: Buffer, format: "pdf" | "bild"): Promise<string>;
}

export interface HashPaar {
  original: string;
  placeholder: string;
  prefix_name?: string;
  hash?: string;
}

export interface AnonymisierungsErgebnis {
  jobIds: string[];
  text: string;
  paare: HashPaar[];
}

export type FindingKategorie =
  | "BEKANNTER_WERT"
  | "EMAIL"
  | "IBAN"
  | "TELEFON"
  | "STEUER_ID"
  | "GEBURTSDATUM"
  | "STRASSE_HAUSNUMMER"
  | "PLZ_ORT"
  | "URL_MIT_PERSONENBEZUG"
  | "ZUSATZPRUEFER";

/** A guard finding. Never contains the raw value, only a masked hint. */
export interface PiiFinding {
  kategorie: FindingKategorie;
  /** Masked, e.g. "M***r (8 Zeichen)". Safe for logs. */
  maske: string;
  position: number;
}

/** Optional additional checker (e.g. local NER via Ollama). Must run locally. */
export type ZusatzPruefer = (text: string) => Promise<{ funde: string[] }>;

export interface PipelineProtokoll {
  laufId: string;
  format: EingabeFormat | null;
  bytes: number;
  zeichenMarkdown: number;
  ocr: boolean;
  anymizeJobs: number;
  ersetzungen: number;
  guardOk: boolean;
  guardFunde: Array<Pick<PiiFinding, "kategorie" | "maske">>;
  anymizeJobsGeloescht: boolean;
  /** Only set when deletion failed: job ids for manual follow-up (no personal data). */
  nichtGeloeschteJobs?: string[];
  offenePlatzhalter: number;
  verarbeiter: string;
  aufgabe?: string;
  nutzung?: { tokensEin?: number; tokensAus?: number; credits?: number };
  dauerMs: Record<string, number>;
  hinweise: string[];
  fehler?: { schritt: PipelineSchritt; code: string };
}

export type PipelineSchritt =
  | "einlesen"
  | "konvertieren"
  | "anonymisieren"
  | "guard"
  | "verarbeiten"
  | "rueckfuehrung"
  | "aufraeumen";

export interface PipelineErgebnis {
  /** Final result with original names restored (stays inside the Kanzlei). */
  ergebnis: string;
  /** What the LLM actually saw/returned (placeholders only). */
  ergebnisAnonymisiert: string;
  protokoll: PipelineProtokoll;
}

/** Error raised by the pipeline. `message` never contains document content. */
export class PipelineFehler extends Error {
  constructor(
    public readonly schritt: PipelineSchritt,
    public readonly code: string,
    message: string,
    public readonly protokoll?: PipelineProtokoll,
  ) {
    super(message);
    this.name = "PipelineFehler";
  }
}
