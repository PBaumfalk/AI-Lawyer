/**
 * PII egress guard: an independent, local second line of defence.
 *
 * anymize promises a recognition rate of ">95 %", not 100 % (anymize AGB
 * § 10.1, Datenschutz § 7.3). This guard therefore checks every text that is
 * about to leave the process (except the anonymisation request itself) and
 * blocks it when it still contains personal data. It knows:
 *
 *  1. every original value anymize replaced (hash pairs), split into name parts,
 *  2. values supplied by the caller (Beteiligte, Mandant, Gegner from the Akte),
 *  3. structured identifiers found by local regexes in the ORIGINAL text
 *     (e-mail, IBAN, phone, tax id, date of birth, street address, PLZ + Ort),
 *  4. the same regexes applied to the OUTGOING text (anything that still looks
 *     like an identifier is suspicious),
 *  5. optionally a local NER checker (e.g. Ollama) for unknown names.
 *
 * Findings carry only masked hints, never the value itself, so they are safe
 * to log.
 */

import type { FindingKategorie, HashPaar, PiiFinding, ZusatzPruefer } from "./types";

const STOPPWOERTER = new Set(
  [
    "herr", "herrn", "frau", "dr", "prof", "dipl", "ing", "von", "van", "de", "der", "die", "das", "den", "dem",
    "und", "zu", "zur", "zum", "gmbh", "mbh", "ag", "kg", "ug", "ohg", "gbr", "ev", "co", "se", "inc", "ltd",
    "rechtsanwalt", "rechtsanwältin", "rechtsanwälte", "kanzlei", "straße", "str", "weg", "platz", "allee",
    "haftungsbeschränkt", "partner", "partnerschaft", "mbb",
  ],
);

/** Matches the documented placeholder styles: [[Person-A1B2C3]], [[NACHNAME-a7f39cd]], [PERSON_1]. */
export const PLATZHALTER_REGEX = /\[\[[^\[\]\n]{1,80}\]\]|\[[A-ZÄÖÜ][A-ZÄÖÜ_]{1,30}_\d{1,6}\]/g;

interface Muster {
  kategorie: FindingKategorie;
  regex: RegExp;
}

const MUSTER: Muster[] = [
  { kategorie: "EMAIL", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kategorie: "IBAN", regex: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  {
    kategorie: "TELEFON",
    // +49 221 1234567, 0221/1234567, 0171-1234567, (0221) 12 34 56. Dates (dd.mm.yyyy) do not match (no dots).
    regex: /(?:\+\d{2,3}[\s/-]?|\b0|\(0)\d{2,5}\)?[\s/-]?\d{2,}(?:[\s-]?\d{2,}){0,3}\b/g,
  },
  { kategorie: "STEUER_ID", regex: /\b(?:Steuer-?ID|IdNr\.?|Steueridentifikationsnummer)[:\s]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/gi },
  {
    kategorie: "GEBURTSDATUM",
    regex: /\b(?:geb\.|geboren(?:\s+am)?|Geburtsdatum:?)\s*(?:am\s*)?\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}/gi,
  },
  {
    kategorie: "STRASSE_HAUSNUMMER",
    regex: /\b[A-ZÄÖÜ][a-zäöüß-]+(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|ufer|chaussee|steig|pfad)\s*\d{1,4}\s?[a-z]?\b/g,
  },
  { kategorie: "PLZ_ORT", regex: /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜ][a-zäöüß]+)?\b/g },
];

export interface GuardOptionen {
  /** Original (pre-anonymisation) text: source for structured identifiers. */
  originalText: string;
  /** anymize hash pairs of this run. */
  paare: HashPaar[];
  /** Additional known personal values (names, addresses of Beteiligte). */
  bekannteWerte?: string[];
  /** Values that may appear in clear text (e.g. court addresses, own Kanzlei). */
  erlaubteWerte?: string[];
  zusatzPruefer?: ZusatzPruefer;
}

export function maskiere(wert: string): string {
  const w = wert.trim();
  if (w.length <= 2) return `** (${w.length} Zeichen)`;
  return `${w[0]}***${w[w.length - 1]} (${w.length} Zeichen)`;
}

function normalisiere(s: string): string {
  return s
    .normalize("NFC")
    .replace(/(?:\\r)?\\n/g, " ") // escaped line breaks in anymize originals (live 2026-11-19)
    .replace(/[­​-‍⁠﻿]/g, "") // soft hyphen, zero-width chars
    .replace(/[  -  ]/g, " ")
    .replace(/[‐-‒–]/g, "-");
}

function nurZiffern(s: string): string {
  return s.replace(/\D/g, "");
}

function escapeRegex(s: string): string {
  // Whitespace inside a value may be any whitespace run (line breaks in PDFs).
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

export class PiiGuard {
  private readonly woerter: Array<{ wert: string; regex: RegExp }> = [];
  private readonly ziffernfolgen: string[] = [];
  private readonly erlaubt: string[];

  constructor(private readonly o: GuardOptionen) {
    this.erlaubt = (o.erlaubteWerte ?? []).map((w) => normalisiere(w).toLowerCase());
    // Names are also checked part by part ("Max Mustermann" -> "Mustermann").
    const namen = new Set<string>();
    const ganz = new Set<string>();
    for (const p of o.paare) {
      if (/person|name|vorname|nachname|firma|organi/i.test(`${p.prefix_name ?? ""} ${p.placeholder}`)) namen.add(p.original);
      else ganz.add(p.original);
    }
    for (const w of o.bekannteWerte ?? []) namen.add(w);
    // Structured identifiers in the original text: only the value, not the label.
    const original = normalisiere(o.originalText);
    for (const m of MUSTER) {
      for (const t of original.matchAll(m.regex)) {
        const wert = m.kategorie === "STEUER_ID" || m.kategorie === "GEBURTSDATUM" ? t[0].replace(/^[^\d]*/, "") : t[0];
        ganz.add(wert);
      }
    }

    for (const [roh, zerlegen] of [...[...ganz].map((w) => [w, false] as const), ...[...namen].map((w) => [w, true] as const)]) {
      const wert = normalisiere(roh).trim();
      if (!wert || this.istErlaubt(wert)) continue;
      const ziffern = nurZiffern(wert);
      if (ziffern.length >= 6 && ziffern.length >= wert.replace(/[\s./-]/g, "").length * 0.6) {
        this.ziffernfolgen.push(ziffern);
        continue;
      }
      this.fuegeWortHinzu(wert);
      if (!zerlegen) continue;
      const teile = wert.split(/[\s,;/]+|(?<=\p{L})-(?=\p{L})/u).map((t) => t.replace(/^[.(]+|[.):]+$/g, ""));
      if (teile.length > 1) {
        for (const t of teile) {
          if (t.length >= 3 && !STOPPWOERTER.has(t.toLowerCase()) && !/\d/.test(t) && !this.istErlaubt(t)) {
            this.fuegeWortHinzu(t);
          }
        }
      }
    }
  }

  private istErlaubt(wert: string): boolean {
    const w = wert.toLowerCase();
    return this.erlaubt.some((e) => e === w || e.includes(w));
  }

  private fuegeWortHinzu(wert: string) {
    if (wert.length < 3) return;
    if (this.woerter.some((w) => w.wert.toLowerCase() === wert.toLowerCase())) return;
    // Letter boundary on both sides; allows German genitive/plural suffix (Müllers, Müllern).
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(wert)}(?:s|n|'s|’s)?(?![\\p{L}\\p{N}])`, "iu");
    this.woerter.push({ wert, regex });
  }

  /** Number of sensitive values the guard knows (for the protocol). */
  get anzahlBekannterWerte(): number {
    return this.woerter.length + this.ziffernfolgen.length;
  }

  /** Synchronous checks 1–4. */
  pruefeSync(ausgehend: string): PiiFinding[] {
    const funde: PiiFinding[] = [];
    // Placeholders are fine; blank them so their inner tokens cannot cause matches.
    const text = normalisiere(ausgehend).replace(PLATZHALTER_REGEX, (m) => " ".repeat(m.length));

    for (const w of this.woerter) {
      const m = w.regex.exec(text);
      if (m) funde.push({ kategorie: "BEKANNTER_WERT", maske: maskiere(w.wert), position: m.index });
    }
    if (this.ziffernfolgen.length) {
      // Digit groups that may be written with separators: "DE89 3704 0044", "0221/123 45".
      for (const g of text.matchAll(/[A-Z]{0,2}\d[\d\s./()+-]*\d/g)) {
        const ziffern = nurZiffern(g[0]);
        for (const z of this.ziffernfolgen) {
          if (ziffern.includes(z)) funde.push({ kategorie: "BEKANNTER_WERT", maske: maskiere(z), position: g.index ?? -1 });
        }
      }
    }
    for (const m of MUSTER) {
      for (const t of text.matchAll(m.regex)) {
        if (this.istErlaubt(t[0])) continue;
        if (m.kategorie === "TELEFON" && nurZiffern(t[0]).length < 7) continue;
        funde.push({ kategorie: m.kategorie, maske: maskiere(t[0]), position: t.index ?? -1 });
      }
    }
    return dedupliziere(funde);
  }

  /** All checks including the optional local NER checker. */
  async pruefe(ausgehend: string): Promise<PiiFinding[]> {
    const funde = this.pruefeSync(ausgehend);
    if (this.o.zusatzPruefer) {
      const ohnePlatzhalter = ausgehend.replace(PLATZHALTER_REGEX, " ");
      const r = await this.o.zusatzPruefer(ohnePlatzhalter);
      for (const name of r.funde) {
        if (!name.trim() || this.istErlaubt(name)) continue;
        // Names the NER model "finds" inside placeholders are not leaks.
        if (!ohnePlatzhalter.includes(name)) continue;
        funde.push({ kategorie: "ZUSATZPRUEFER", maske: maskiere(name), position: ohnePlatzhalter.indexOf(name) });
      }
    }
    return dedupliziere(funde);
  }
}

function dedupliziere(funde: PiiFinding[]): PiiFinding[] {
  const gesehen = new Set<string>();
  return funde.filter((f) => {
    const k = `${f.kategorie}|${f.position}|${f.maske}`;
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });
}
