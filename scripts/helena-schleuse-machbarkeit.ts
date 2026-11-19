/**
 * Feasibility test: agentic tool use through anymize behind the Datenschutz-Schleuse.
 * Fictitious data only.
 *
 *   ANYMIZE_API_KEY=... npx tsx scripts/helena-schleuse-machbarkeit.ts > bericht.json
 *
 * Questions answered per model:
 *  1. Does the model call tools via anymize (AI SDK generateText + maxSteps, like Helena's orchestrator)?
 *  2. Do tool results with personal data reach the model only pseudonymised?
 *  3. Do placeholder arguments resolve locally to the real person (contact lookup)?
 *  4. Same person, same placeholder across separate anymize jobs?
 *  5. Time and number of anymize jobs.
 *  6. No personal value in any request to the LLM (recorded at network level).
 *  7. Final result fully re-identified.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { AnymizeClient } from "../src/lib/helena/datei-pipeline/anymize-client";
import { DatenschutzSchleuse } from "../src/lib/helena/datei-pipeline/schleuse";
import { zuMarkdown } from "../src/lib/helena/datei-pipeline/konvertieren";
import { systemPromptFuer } from "../src/lib/helena/datei-pipeline/verarbeiter";
import { PipelineFehler } from "../src/lib/helena/datei-pipeline/types";

const KEY = process.env.ANYMIZE_API_KEY ?? "";
const BASE = "https://app.anymize.ai";
const MODELLE = (process.env.MODELLE ?? "anthropic/claude-opus-5.5,waterfall-2.0,mistralai/mistral-large-4").split(",");
const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;

// Fictitious contact database (stands in for prisma.kontakt).
const KONTAKTE: Record<string, Record<string, string>> = {
  "Sabine Krüger-Wendt": { geburtsdatum: "14.07.1983", beschaeftigt_seit: "01.04.2015", unterhaltspflichten: "2 Kinder", schwerbehinderung: "nein" },
  "Matthias Oberländer": { funktion: "Niederlassungsleiter, kündigungsberechtigt laut Handelsregister: nein" },
};

const MUSTER = `Muster Kündigungsschutzklage (kanzleieigen, anonymisiert)
Anträge:
1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die Kündigung der Beklagten vom [Datum], zugegangen am [Datum], nicht aufgelöst worden ist.
2. Die Beklagte wird verurteilt, die Klagepartei bis zum rechtskräftigen Abschluss des Verfahrens zu unveränderten Bedingungen als [Funktion] weiterzubeschäftigen.
Begründung (Gliederung): I. Parteien und Arbeitsverhältnis (Beginn, Tätigkeit, Bruttomonatsgehalt, Betriebsgröße > 10 AN, § 23 KSchG) II. Kündigung und Zugang III. Soziale Rechtfertigung bestritten (§ 1 Abs. 2 KSchG), Darlegungslast Arbeitgeber IV. Sozialauswahl gerügt (§ 1 Abs. 3 KSchG), Auskunft verlangt V. Betriebsratsanhörung mit Nichtwissen bestritten (§ 102 BetrVG) VI. Weiterbeschäftigungsanspruch (BAG GS).`;

interface Ergebnis {
  modell: string;
  ok: boolean;
  fehler?: string;
  werkzeugaufrufe: Array<{ werkzeug: string; argumentHatPlatzhalter?: boolean; aufgeloest?: boolean }>;
  schritte: number;
  dauerS: number;
  anymizeJobs: number;
  anymizeMsJeJob: number[];
  geprueftAnfragen: number;
  blockiert: number;
  lecks: string[];
  offenePlatzhalter: number;
  ergebnisEnthaeltMandantin: boolean;
  platzhalterKonsistenz: Record<string, number>;
  ergebnisAuszug: string;
}

async function lauf(modell: string, anymize: AnymizeClient): Promise<Ergebnis> {
  const schleuse = new DatenschutzSchleuse(anymize);
  const aufzeichnung: string[] = [];
  const werkzeugaufrufe: Ergebnis["werkzeugaufrufe"] = [];
  const t0 = Date.now();

  // Record every LLM request (after the guard passed) for the independent leak check.
  const aufzeichnenderFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") aufzeichnung.push(init.body);
    return fetch(input, init);
  }) as typeof fetch;
  const fetchMitGuard = schleuse.geschuetzterFetch(aufzeichnenderFetch, (body) => {
    if (/^(fountain|waterfall)-/.test(String(body.model))) body.reasoning_effort = "low";
  });
  const provider = createOpenAI({ apiKey: KEY, baseURL: `${BASE}/api/v1/llm`, compatibility: "compatible", fetch: fetchMitGuard });

  const tools = {
    akte_lesen: tool({
      description: "Liest den Akteninhalt (Gesprächsnotiz, E-Mail der Mandantin).",
      parameters: z.object({}),
      execute: async () => {
        werkzeugaufrufe.push({ werkzeug: "akte_lesen" });
        const teile = await Promise.all(
          ["akte.pdf", "email-mandantin.eml"].map((f) => zuMarkdown({ daten: readFileSync(path.join(DIR, f)), dateiname: f })),
        );
        return schleuse.einlassen(teile.map((t) => t.markdown).join("\n\n"));
      },
    }),
    muster_suchen: tool({
      description: "Sucht kanzleieigene Schriftsatzmuster.",
      parameters: z.object({ suchbegriff: z.string() }),
      execute: async ({ suchbegriff }) => {
        werkzeugaufrufe.push({ werkzeug: `muster_suchen(${suchbegriff.slice(0, 40)})` });
        return schleuse.einlassen(MUSTER);
      },
    }),
    kontakt_details: tool({
      description: "Liefert Stammdaten zu einer Person aus der Akte. Übergib die Person genau so, wie sie im Text steht (Platzhalter unverändert).",
      parameters: z.object({ person: z.string() }),
      execute: async ({ person }) => {
        const real = schleuse.rueckfuehren(person).text.trim();
        const treffer = KONTAKTE[real] ?? Object.entries(KONTAKTE).find(([n]) => n.includes(real) || real.includes(n.split(" ").pop()!))?.[1];
        werkzeugaufrufe.push({ werkzeug: "kontakt_details", argumentHatPlatzhalter: /\[\[[^\]]+\]\]/.test(person), aufgeloest: !!treffer });
        const antwort = treffer ? `Stammdaten zu ${real}: ${JSON.stringify(treffer)}` : "Keine Stammdaten gefunden.";
        return schleuse.einlassen(antwort);
      },
    }),
  };

  const ergebnis: Ergebnis = {
    modell, ok: false, werkzeugaufrufe, schritte: 0, dauerS: 0, anymizeJobs: 0, anymizeMsJeJob: [], geprueftAnfragen: 0, blockiert: 0,
    lecks: [], offenePlatzhalter: 0, ergebnisEnthaeltMandantin: false, platzhalterKonsistenz: {}, ergebnisAuszug: "",
  };
  try {
    const auftrag = await schleuse.einlassen(
      "Entwirf die Anträge und eine knapp gegliederte Begründung einer Kündigungsschutzklage für unsere Mandantin. " +
        "Lies zuerst die Akte, suche dann ein passendes kanzleieigenes Muster und hole die Stammdaten der Mandantin, bevor du schreibst.",
    );
    const r = await generateText({
      model: provider.chat(modell),
      system: systemPromptFuer("schriftsatz") + "\n\nDu hast Werkzeuge. Nutze sie, statt Angaben zu erfinden.",
      prompt: auftrag,
      tools,
      maxSteps: 8,
      temperature: 0.2,
      maxTokens: 6000,
    });
    ergebnis.schritte = r.steps.length;
    const zurueck = schleuse.rueckfuehren(r.text);
    ergebnis.offenePlatzhalter = zurueck.offen;
    ergebnis.ergebnisEnthaeltMandantin = zurueck.text.includes("Krüger-Wendt");
    ergebnis.ergebnisAuszug = zurueck.text.slice(0, 600);
    ergebnis.ok = r.text.trim().length > 0;
  } catch (e) {
    ergebnis.fehler = e instanceof PipelineFehler ? `${e.code}: ${e.message}` : `${(e as Error).name}: ${String((e as Error).message).slice(0, 200)}`;
  } finally {
    await schleuse.aufraeumen();
  }
  ergebnis.dauerS = Math.round((Date.now() - t0) / 1000);
  ergebnis.anymizeJobs = schleuse.statistik.anymizeJobs;
  ergebnis.anymizeMsJeJob = schleuse.statistik.anymizeMs;
  ergebnis.geprueftAnfragen = schleuse.statistik.geprueftAnfragen;
  ergebnis.blockiert = schleuse.statistik.blockiert;
  // Independent leak check over everything actually sent to the LLM.
  const flach = (s: string) => s.normalize("NFC").replace(/\s+/g, " ");
  for (const body of aufzeichnung) {
    const alles = flach(body + "\n" + JSON.stringify(JSON.parse(body)));
    for (const w of PII) if (alles.includes(flach(w)) && !ergebnis.lecks.includes(w)) ergebnis.lecks.push(w);
  }
  for (const [wert, ph] of schleuse.platzhalterJeWert) {
    if (/Krüger-Wendt|Oberländer/.test(wert)) ergebnis.platzhalterKonsistenz[wert.replace(/[A-Za-zäöüß]/g, (c, i) => (i === 0 ? c : "*"))] = ph.size;
  }
  return ergebnis;
}

async function main() {
  if (!KEY) throw new Error("ANYMIZE_API_KEY fehlt");
  const anymize = new AnymizeClient({ apiKey: KEY, baseUrl: BASE });
  const alle: Ergebnis[] = [];
  for (const m of MODELLE) {
    process.stderr.write(`${m} ... `);
    const e = await lauf(m, anymize);
    process.stderr.write(`${e.ok ? "ok" : "FEHLER " + e.fehler} (${e.dauerS} s, ${e.werkzeugaufrufe.length} Werkzeugaufrufe, Lecks ${e.lecks.length})\n`);
    alle.push(e);
  }
  process.stdout.write(JSON.stringify(alle, null, 2));
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
