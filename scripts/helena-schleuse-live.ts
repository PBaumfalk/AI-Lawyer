/**
 * Live check of the Datenschutz-Schleuse middleware (the code path Helena uses)
 * against real anymize. Fictitious data only. No database needed.
 *
 *   ANYMIZE_API_KEY=... npx tsx scripts/helena-schleuse-live.ts
 *
 * Modes: agent with tools (generateText + maxSteps), streaming (streamText),
 * structured output (generateObject). Every request to the LLM is recorded
 * and checked independently against the reference list.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText, generateObject, streamText, tool, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { mitKiKontext, schuetzeModell } from "../src/lib/ai/datenschutz-schleuse";
import { AnymizeClient } from "../src/lib/helena/datei-pipeline/anymize-client";
import { modellEintrag } from "../src/lib/helena/datei-pipeline/modelle";
import { zuMarkdown } from "../src/lib/helena/datei-pipeline/konvertieren";

const KEY = process.env.ANYMIZE_API_KEY ?? "";
const BASE = "https://app.anymize.ai";
const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;
const aufzeichnung: string[] = [];

function modell(id: string): LanguageModel {
  const p = createOpenAI({
    apiKey: KEY,
    baseURL: `${BASE}/api/v1/llm`,
    compatibility: "compatible",
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        const b = JSON.parse(init.body);
        if (modellEintrag(id)?.denkaufwand) b.reasoning_effort ??= "low";
        init = { ...init, body: JSON.stringify(b) };
        aufzeichnung.push(init.body as string);
      }
      return fetch(input, init);
    }) as typeof fetch,
  });
  return schuetzeModell(p.chat(id), {
    anymize: () => new AnymizeClient({ apiKey: KEY, baseUrl: BASE }),
    standort: modellEintrag(id)!.standort,
    ersatzModell: () => createOpenAI({ apiKey: KEY, baseURL: `${BASE}/api/v1/llm`, compatibility: "compatible" }).chat("waterfall-2.0"),
    einwilligungLaden: async () => "FREMDMODELLE",
    einwilligungErforderlich: true,
    bekannteWerteLaden: async () => ["Sabine Krüger-Wendt", "Aylin Demirtaş", "Jürgen Pakulla"],
    log: { warn: (o) => console.log("  Guard-Funde:", JSON.stringify(o)) },
  });
}

async function akte(): Promise<string> {
  const t = await Promise.all(["akte.pdf", "email-mandantin.eml"].map((f) => zuMarkdown({ daten: readFileSync(path.join(DIR, f)), dateiname: f })));
  return t.map((x) => x.markdown).join("\n\n");
}

function lecks(seit: number): string[] {
  const flach = (s: string) => s.normalize("NFC").replace(/\s+/g, " ");
  const gefunden = new Set<string>();
  for (const b of aufzeichnung.slice(seit)) {
    const alles = flach(b + "\n" + JSON.stringify(JSON.parse(b)));
    for (const w of PII) if (alles.includes(flach(w))) gefunden.add(w);
  }
  return [...gefunden];
}

async function pruefe(name: string, fn: () => Promise<string>) {
  const seit = aufzeichnung.length;
  const t0 = Date.now();
  try {
    const text = await mitKiKontext({ akteId: `live-${name}` }, fn);
    const l = lecks(seit);
    console.log(
      `${name}: ok, ${Math.round((Date.now() - t0) / 1000)} s, ${aufzeichnung.length - seit} KI-Anfragen, Lecks ${l.length}${l.length ? " " + l.join(", ") : ""}, ` +
        `Platzhalter offen ${(text.match(/\[\[[^\]]+\]\]/g) ?? []).length}, Mandantin im Ergebnis ${/Krüger-Wendt/.test(text)}`,
    );
    console.log(`  Auszug: ${JSON.stringify(text.slice(0, 220))}`);
  } catch (e) {
    console.log(`${name}: FEHLER ${(e as Error).name}: ${String((e as Error).message).slice(0, 200)} | Lecks ${lecks(seit).length}`);
  }
}

async function main() {
  if (!KEY) throw new Error("ANYMIZE_API_KEY fehlt");
  const inhalt = await akte();
  let kontaktArg = "";
  const tools = {
    akte_lesen: tool({ description: "Liest den Akteninhalt.", parameters: z.object({}), execute: async () => inhalt }),
    kontakt_details: tool({
      description: "Stammdaten zu einer Person. Person genau so übergeben, wie sie im Text steht.",
      parameters: z.object({ person: z.string() }),
      execute: async ({ person }) => {
        kontaktArg = person;
        return /Krüger-Wendt/.test(person) ? `Stammdaten ${person}: geboren 14.07.1983, beschäftigt seit 01.04.2015, 2 Kinder` : "Keine Stammdaten.";
      },
    }),
  };

  for (const id of (process.env.NUR ?? "anthropic/claude-opus-5.5,waterfall-2.0").split(",")) {
    kontaktArg = "";
    await pruefe(`Agent mit Werkzeugen (${id})`, async () => {
      const r = await generateText({
        model: modell(id),
        system: "Du bist Helena. Platzhalter wie [[person-AB12CD]] exakt übernehmen. Nutze die Werkzeuge.",
        prompt: "Lies die Akte, hole die Stammdaten der Mandantin und nenne in drei Sätzen: Wer klagt gegen wen, bis wann muss die Klage eingereicht sein, welche Sozialdaten sind relevant?",
        tools,
        maxSteps: 6,
        maxTokens: 2000,
      });
      return r.text;
    });
    console.log(`  Werkzeug kontakt_details bekam echten Namen: ${/Krüger-Wendt/.test(kontaktArg)}`);
  }

  await pruefe("Streaming wie im Chat (waterfall-2.0)", async () => {
    const r = streamText({
      model: modell("waterfall-2.0"),
      system: `Du bist Helena. Akte:\n${inhalt}`,
      prompt: "Fasse den Fall für Frau Krüger-Wendt in vier Sätzen zusammen.",
      maxTokens: 1500,
    });
    let t = "";
    for await (const d of r.textStream) t += d;
    return t;
  });

  await pruefe("Strukturierte Ausgabe wie im Schriftsatz-Ablauf (waterfall-2.0)", async () => {
    const r = await generateObject({
      model: modell("waterfall-2.0"),
      schema: z.object({ klaeger: z.string(), beklagte: z.string(), zugang_kuendigung: z.string(), klagefrist_ende: z.string() }),
      prompt: `Entnimm der Akte die Angaben für das Rubrum einer Kündigungsschutzklage.\n\n${inhalt}`,
      maxTokens: 1500,
    });
    return JSON.stringify(r.object);
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
