/**
 * Quality comparison of anymize models for Helena tasks (fictitious sample data only).
 *
 *   ANYMIZE_API_KEY=... npx tsx scripts/helena-modellvergleich.ts [ausgabeOrdner]
 *
 * Every model runs through the real pipeline (anonymisation, guard, LLM,
 * re-identification). Foundation models are allowed here only because the
 * input is fictitious test data.
 *
 * Output: bericht.md (blind: models labelled A..E, order shuffled) and
 * schluessel.json (label -> model). Read the report first, rate, then open the key.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { AnymizeClient } from "../src/lib/helena/datei-pipeline/anymize-client";
import { verarbeiteDateien } from "../src/lib/helena/datei-pipeline/pipeline";
import { zuMarkdown } from "../src/lib/helena/datei-pipeline/konvertieren";
import { anymizeLlmVerarbeiter } from "../src/lib/helena/datei-pipeline/verarbeiter";
import { PipelineFehler, type PipelineProtokoll } from "../src/lib/helena/datei-pipeline/types";
import { modellEintrag, type Aufgabe } from "../src/lib/helena/datei-pipeline/modelle";

const MODELLE = [
  "fountain-2.0",
  "waterfall-2.0",
  "mistralai/mistral-large-4",
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-opus-5.5",
];

const FIXTURES = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const EINGABE = ["akte.pdf", "email-mandantin.eml"];
const ZUGANG = "Die Kündigung wurde der Mandantin am 03.11.2026 persönlich übergeben.";

const AUFGABEN: Array<{ aufgabe: Aufgabe; titel: string; auftrag: string; fristErwartet: boolean; norm102: boolean }> = [
  {
    aufgabe: "extrahieren",
    titel: "Daten herausziehen",
    auftrag: "Erstelle eine Übersicht: Beteiligte mit Rolle, alle Daten mit ihrer Bedeutung, Beträge, offene Punkte.",
    fristErwartet: false,
    norm102: false,
  },
  {
    aufgabe: "zusammenfassen",
    titel: "Sachstand",
    auftrag: `Fasse den Sachstand für die Akte in höchstens acht Sätzen zusammen und nenne das Ende der Klagefrist nach § 4 KSchG. ${ZUGANG}`,
    fristErwartet: true,
    norm102: false,
  },
  {
    aufgabe: "mandantenbrief",
    titel: "Mandantenbrief",
    auftrag: `Schreibe der Mandantin einen kurzen Brief: was wir jetzt tun, bis wann die Klage spätestens eingereicht sein muss und welche Unterlagen sie uns schicken soll. ${ZUGANG}`,
    fristErwartet: true,
    norm102: false,
  },
  {
    aufgabe: "schriftsatz",
    titel: "Kündigungsschutzklage",
    auftrag: `Entwirf die Kündigungsschutzklage zum Arbeitsgericht Köln mit Anträgen und Begründung. ${ZUGANG} Der Betrieb hat etwa 120 Arbeitnehmer.`,
    fristErwartet: false,
    norm102: true,
  },
  {
    aufgabe: "wuerdigung",
    titel: "Erfolgsaussichten",
    auftrag: `Prüfe die Erfolgsaussichten einer Kündigungsschutzklage: Anwendbarkeit des KSchG, soziale Rechtfertigung, Anhörung des Betriebsrats, Klagefrist. Was müssen wir noch klären? ${ZUGANG} Der Betrieb hat etwa 120 Arbeitnehmer.`,
    fristErwartet: true,
    norm102: true,
  },
];

interface Lauf {
  modell: string;
  aufgabe: Aufgabe;
  ok: boolean;
  text: string;
  fehler?: string;
  protokoll?: PipelineProtokoll;
  dauerMs: number;
}

/** EUR from tokens and anymize's published price list; null if no price is published. */
function kosten(l: Lauf): number | null {
  const p = modellEintrag(l.modell)?.preis;
  const n = l.protokoll?.nutzung;
  if (!p || !n?.tokensEin || !n?.tokensAus) return null;
  return (n.tokensEin * p.ein + n.tokensAus * p.aus) / 1_000_000;
}

function mischen<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Names after "Herr/Frau/Dr." in the output that do not occur in the source: hallucination hint. */
function fremdeNamen(text: string, quelle: string): string[] {
  const treffer = new Set<string>();
  for (const m of text.matchAll(/\b(?:Herrn?|Frau|Dr\.)\s+((?:[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?\s?){1,2})/g)) {
    const name = m[1].trim();
    if (!quelle.includes(name) && !/^(Rechtsanwalt|Rechtsanwältin|Kollege|Kollegin|Vorsitzende|Richter|Richterin|Mandantin)$/.test(name)) treffer.add(name);
  }
  return [...treffer];
}

async function main() {
  const key = process.env.ANYMIZE_API_KEY;
  if (!key) throw new Error("ANYMIZE_API_KEY fehlt");
  const ziel = process.argv[2] ?? path.join("docs/modellvergleich", new Date().toISOString().slice(0, 10));
  mkdirSync(ziel, { recursive: true });

  const anymize = new AnymizeClient({ apiKey: key });
  const quelle = (
    await Promise.all(EINGABE.map((f) => zuMarkdown({ daten: readFileSync(path.join(FIXTURES, f)), dateiname: f })))
  ).map((k) => k.markdown).join("\n");

  const laeufe: Lauf[] = [];
  for (const t of AUFGABEN) {
    for (const modell of MODELLE) {
      const start = Date.now();
      process.stderr.write(`${t.aufgabe} / ${modell} ... `);
      try {
        const r = await verarbeiteDateien({
          dateien: EINGABE.map((f) => ({ daten: readFileSync(path.join(FIXTURES, f)), dateiname: f })),
          auftrag: t.auftrag,
          aufgabe: t.aufgabe,
          anymize,
          verarbeiter: anymizeLlmVerarbeiter({ apiKey: key, modell }),
          erlaubteStandorte: ["anymize-de", "fremdanbieter"], // fictitious test data only
        });
        laeufe.push({ modell, aufgabe: t.aufgabe, ok: true, text: r.ergebnis, protokoll: r.protokoll, dauerMs: Date.now() - start });
        process.stderr.write("ok\n");
      } catch (e) {
        const f = e instanceof PipelineFehler ? `${e.code}: ${e.message}` : String(e);
        laeufe.push({ modell, aufgabe: t.aufgabe, ok: false, text: "", fehler: f, protokoll: (e as PipelineFehler).protokoll, dauerMs: Date.now() - start });
        process.stderr.write(`FEHLER ${f}\n`);
      }
    }
  }

  // Blind labels, shuffled once for the whole run.
  const buchstaben = "ABCDE".split("");
  const zuordnung = Object.fromEntries(mischen(MODELLE).map((m, i) => [m, buchstaben[i]]));
  writeFileSync(path.join(ziel, "schluessel.json"), JSON.stringify(Object.fromEntries(Object.entries(zuordnung).map(([m, b]) => [b, m])), null, 2));
  writeFileSync(
    path.join(ziel, "rohdaten.json"),
    JSON.stringify(laeufe.map((l) => ({ ...l, modell: zuordnung[l.modell] })), null, 2),
  );

  const zeilen: string[] = [
    `# Modellvergleich Helena (blind)`,
    "",
    `Stand ${new Date().toLocaleString("de-DE")}. Eingabe: fiktive Beispielakte (PDF + E-Mail), über die vollständige Pipeline (anymize-Anonymisierung, Ausgangs-Check, Rückführung).`,
    "",
    "Die Modelle heißen A bis E, die Zuordnung steht in `schluessel.json`. Bitte erst bewerten, dann nachsehen.",
    "",
    "Automatische Prüfungen: **Frist** = richtiges Ende der Klagefrist (24.11.2026) genannt; **Platzh.** = alle Platzhalter zurückgeführt; **fremde Namen** = Personen nach Herr/Frau/Dr., die nicht in der Akte stehen; **§ 102** = § 102 BetrVG erwähnt; Kosten aus Tokens × veröffentlichtem anymize-Preis (für Fremdmodelle veröffentlicht anymize keine Preise je Token in der API-Doku).",
    "",
  ];

  // Summary table per label
  zeilen.push("## Übersicht", "", "| Modell | Läufe ok | Frist richtig | Platzhalter offen | fremde Namen | Ø Dauer | Tokens aus | Kosten gesamt |", "|---|---|---|---|---|---|---|---|");
  for (const b of buchstaben) {
    const modell = Object.keys(zuordnung).find((m) => zuordnung[m] === b)!;
    const ls = laeufe.filter((l) => l.modell === modell);
    const okLaeufe = ls.filter((l) => l.ok);
    const fristLaeufe = okLaeufe.filter((l) => AUFGABEN.find((t) => t.aufgabe === l.aufgabe)!.fristErwartet);
    const fristOk = fristLaeufe.filter((l) => /24\.\s?11\.\s?2026|24\. November 2026/.test(l.text)).length;
    const offen = okLaeufe.reduce((s, l) => s + (l.protokoll?.offenePlatzhalter ?? 0), 0);
    const fremd = okLaeufe.reduce((s, l) => s + fremdeNamen(l.text, quelle).length, 0);
    const k = okLaeufe.map(kosten);
    const kostenText = k.length && k.every((x) => x !== null) ? `${(k as number[]).reduce((a, b) => a + b, 0).toFixed(4)} €` : "Preis nicht veröffentlicht";
    const tokensAus = okLaeufe.reduce((s, l) => s + (l.protokoll?.nutzung?.tokensAus ?? 0), 0);
    const dauer = Math.round(okLaeufe.reduce((s, l) => s + l.dauerMs, 0) / Math.max(1, okLaeufe.length) / 1000);
    zeilen.push(`| ${b} | ${okLaeufe.length}/${ls.length} | ${fristOk}/${fristLaeufe.length} | ${offen} | ${fremd} | ${dauer} s | ${tokensAus} | ${kostenText} |`);
  }
  zeilen.push("");

  for (const t of AUFGABEN) {
    zeilen.push(`## ${t.titel} (${t.aufgabe})`, "", `> Auftrag: ${t.auftrag}`, "");
    for (const b of buchstaben) {
      const modell = Object.keys(zuordnung).find((m) => zuordnung[m] === b)!;
      const l = laeufe.find((x) => x.modell === modell && x.aufgabe === t.aufgabe)!;
      if (!l.ok) {
        zeilen.push(`### Modell ${b}`, "", `**Fehler:** ${l.fehler} ${(l.protokoll?.hinweise ?? []).filter((h) => h.startsWith("KI-Fehler")).join(" ")}`, "");
        continue;
      }
      const pruef: string[] = [];
      if (t.fristErwartet) pruef.push(/24\.\s?11\.\s?2026|24\. November 2026/.test(l.text) ? "Frist ✓" : "Frist ✗");
      if (t.norm102) pruef.push(/§\s?102\s?BetrVG/.test(l.text) ? "§ 102 ✓" : "§ 102 ✗");
      pruef.push(`Platzh. offen ${l.protokoll?.offenePlatzhalter ?? "?"}`);
      const fremd = fremdeNamen(l.text, quelle);
      if (fremd.length) pruef.push(`fremde Namen: ${fremd.join(", ")}`);
      pruef.push(`${Math.round(l.dauerMs / 1000)} s`);
      if (l.protokoll?.nutzung?.tokensAus) pruef.push(`${l.protokoll.nutzung.tokensAus} Tokens aus`);
      zeilen.push(`### Modell ${b}`, "", `*${pruef.join(" · ")}*`, "", l.ok ? l.text : `**Fehler:** ${l.fehler}`, "", "**Bewertung (1–5):** ___", "");
    }
  }
  writeFileSync(path.join(ziel, "bericht.md"), zeilen.join("\n"));
  process.stderr.write(`\nBericht: ${path.join(ziel, "bericht.md")}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
