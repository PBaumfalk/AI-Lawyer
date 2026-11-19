/**
 * beA sending rules: character set, attachment limits and eEB date.
 *
 * Pure functions without server dependencies: this module is imported by
 * client components (compose form) as well as by the API routes.
 */

export interface ZeichenVerstoss {
  /** Field key: betreff, text, aktenzeichenAbsender, aktenzeichenEmpfaenger or anhaenge.<index> */
  feld: string;
  zeichen: string;
  /** e.g. "U+201E" */
  codePoint: string;
  /** Index in code points (not UTF-16 units): an emoji before it counts as one. */
  position: number;
  ersatz: string | null;
}

const ERSATZ: Record<string, string> = {
  "„": '"', // „
  "“": '"', // “
  "”": '"', // ”
  "″": '"', // ″
  "‚": "'", // ‚
  "‘": "'", // ‘
  "’": "'", // ’
  "′": "'", // ′
  "–": "-", // –
  "—": "-", // —
  "…": "...", // …
};

const MB = 1_048_576;
const MAX_ANHAENGE = 1000;
const WARN_ANHAENGE = 50;
const MAX_BYTES = 200 * MB;
const WARN_BYTES = 60 * MB;

function erlaubt(cp: number): boolean {
  return (
    cp === 0x09 || cp === 0x0a || cp === 0x0d ||
    (cp >= 0x20 && cp <= 0x7e) ||
    (cp >= 0xa0 && cp <= 0x17f) ||
    cp === 0x20ac
  );
}

function formatCodePoint(cp: number): string {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

/** Reports every character outside the beA character set. */
export function pruefeZeichensatz(feld: string, text: string): ZeichenVerstoss[] {
  const verstoesse: ZeichenVerstoss[] = [];
  let position = 0;
  // for...of iterates by code point, so a surrogate pair yields one violation
  for (const zeichen of text) {
    const cp = zeichen.codePointAt(0)!;
    if (!erlaubt(cp)) {
      verstoesse.push({ feld, zeichen, codePoint: formatCodePoint(cp), position, ersatz: ERSATZ[zeichen] ?? null });
    }
    position++;
  }
  return verstoesse;
}

/** Replaces typographic quotes, dashes and ellipsis by their ASCII forms. */
export function ersetzeTypografie(text: string): string {
  let ergebnis = "";
  for (const zeichen of text) ergebnis += ERSATZ[zeichen] ?? zeichen;
  return ergebnis;
}

export interface VersandEingabe {
  betreff: string;
  text: string;
  empfaengerSafeIds: string[];
  eebAnfordern: boolean;
  aktenzeichenAbsender?: string;
  aktenzeichenEmpfaenger?: string;
  anhaenge: { name: string; groesse: number }[];
}

export interface VersandPruefung {
  fehler: string[];
  warnungen: string[];
  verstoesse: ZeichenVerstoss[];
}

/** Checks a message against the beA limits and character set before sending. */
export function pruefeVersand(e: VersandEingabe): VersandPruefung {
  const fehler: string[] = [];
  const warnungen: string[] = [];

  if (!e.betreff.trim()) fehler.push("Betreff fehlt");
  if (!e.empfaengerSafeIds.some((s) => s.trim())) fehler.push("Mindestens ein Empfänger ist erforderlich");
  if (e.eebAnfordern && e.anhaenge.length === 0) {
    fehler.push("Ein eEB kann nur für Nachrichten mit mindestens einem Anhang angefordert werden");
  }

  if (e.anhaenge.length > MAX_ANHAENGE) fehler.push("Höchstens 1000 Anhänge erlaubt");
  else if (e.anhaenge.length > WARN_ANHAENGE) warnungen.push("Mehr als 50 Anhänge");

  const summe = e.anhaenge.reduce((s, a) => s + a.groesse, 0);
  if (summe > MAX_BYTES) fehler.push("Anhänge dürfen zusammen höchstens 200 MB groß sein");
  else if (summe > WARN_BYTES) warnungen.push("Anhänge größer als 60 MB");

  const verstoesse = [
    ...pruefeZeichensatz("betreff", e.betreff),
    ...pruefeZeichensatz("text", e.text),
    ...pruefeZeichensatz("aktenzeichenAbsender", e.aktenzeichenAbsender ?? ""),
    ...pruefeZeichensatz("aktenzeichenEmpfaenger", e.aktenzeichenEmpfaenger ?? ""),
    ...e.anhaenge.flatMap((a, i) => pruefeZeichensatz(`anhaenge.${i}`, a.name)),
  ];

  return { fehler, warnungen, verstoesse };
}

/** Today's date (YYYY-MM-DD) in Europe/Berlin. */
export function heuteBerlin(jetzt: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(jetzt);
}

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

function istGueltigesDatum(d: string): boolean {
  const m = DATUM.exec(d);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const x = new Date(Date.UTC(j, mo - 1, t));
  return x.getUTCFullYear() === j && x.getUTCMonth() === mo - 1 && x.getUTCDate() === t;
}

/** Subtracts calendar months from YYYY-MM-DD; the day is clamped to the month's end. */
export function minusKalendermonate(datum: string, monate: number): string {
  const m = DATUM.exec(datum);
  if (!m) throw new Error(`Ungültiges Datum: ${datum}`);
  const gesamt = Number(m[1]) * 12 + (Number(m[2]) - 1) - monate;
  const jahr = Math.floor(gesamt / 12);
  const monat = gesamt - jahr * 12; // 0-based
  const letzterTag = new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
  const tag = Math.min(Number(m[3]), letzterTag);
  return `${String(jahr).padStart(4, "0")}-${String(monat + 1).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/**
 * Validates the eEB date: not after today and not before today minus two
 * calendar months (Europe/Berlin). Returns an error message or null.
 */
export function pruefeEebDatum(abgabeDatum: string, heute: Date = new Date()): string | null {
  if (!istGueltigesDatum(abgabeDatum)) return "Ungültiges Abgabedatum";
  const h = heuteBerlin(heute);
  // ISO dates compare correctly as strings
  if (abgabeDatum > h) return "Das Abgabedatum darf nicht in der Zukunft liegen";
  if (abgabeDatum < minusKalendermonate(h, 2)) return "Das Abgabedatum darf höchstens zwei Monate zurückliegen";
  return null;
}
