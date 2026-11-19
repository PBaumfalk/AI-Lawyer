import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { generateText, generateObject, streamText, tool } from "ai";
import { MockLanguageModelV1, simulateReadableStream } from "ai/test";
import type { LanguageModelV1CallOptions } from "@ai-sdk/provider";
import { z } from "zod";
import { mitKiKontext, schuetzeModell, type SchleusenKonfig } from "../datenschutz-schleuse";
import { AnymizeClient } from "@/lib/helena/datei-pipeline/anymize-client";
import { PipelineFehler, type ZusatzPruefer } from "@/lib/helena/datei-pipeline/types";
import { erstelleAnymizeMock, BASIS } from "@/lib/helena/datei-pipeline/__tests__/anymize-mock";

const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;
const AKTE = readFileSync(path.join(DIR, "akte.md"), "utf8");
const USAGE = { promptTokens: 1, completionTokens: 1 };

function gesehenOhnePii(prompts: LanguageModelV1CallOptions["prompt"][]) {
  const alles = JSON.stringify(prompts);
  for (const w of PII) expect(alles, `"${w}" ging an das Modell`).not.toContain(w);
}

function aufbau(o: { erkennt?: string[]; bekannte?: string[]; zusatz?: ZusatzPruefer } = {}) {
  const mock = erstelleAnymizeMock({ erkennt: o.erkennt ?? PII, pollsBisFertig: 1 });
  const anymize = new AnymizeClient({ apiKey: "ANYM_test", baseUrl: BASIS, fetchImpl: mock.fetchImpl, schlafen: async () => {} });
  const konfig: SchleusenKonfig = {
    anymize: () => anymize,
    bekannteWerteLaden: async () => o.bekannte ?? [],
    zusatzPruefer: o.zusatz,
  };
  return { mock, anymize, konfig };
}

const platzhalterIn = (prompt: LanguageModelV1CallOptions["prompt"]) => (JSON.stringify(prompt).match(/\[\[person-[0-9A-F]{6}\]\]/g) ?? []);

describe("Datenschutz-Schleuse als Middleware", () => {
  it("Agent mit Werkzeugen: Modell sieht nur Platzhalter, Werkzeug bekommt echten Namen, Antwort zurückgeführt", async () => {
    const { mock, konfig } = aufbau();
    const prompts: LanguageModelV1CallOptions["prompt"][] = [];
    let schritt = 0;
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        prompts.push(opt.prompt);
        schritt++;
        const basis = { rawCall: { rawPrompt: null, rawSettings: {} }, usage: USAGE };
        if (schritt === 1) return { ...basis, finishReason: "tool-calls", toolCalls: [{ toolCallType: "function", toolCallId: "t1", toolName: "akte_lesen", args: "{}" }] };
        const ph = platzhalterIn(opt.prompt)[0];
        if (schritt === 2) return { ...basis, finishReason: "tool-calls", toolCalls: [{ toolCallType: "function", toolCallId: "t2", toolName: "kontakt", args: JSON.stringify({ person: ph }) }] };
        return { ...basis, finishReason: "stop", text: `Entwurf für ${ph}: Klage bis 24.11.2026.` };
      },
    });
    let kontaktArg = "";
    const r = await mitKiKontext({ akteId: "akte1" }, () =>
      generateText({
        model: schuetzeModell(modell, konfig),
        system: "Du bist Helena.",
        prompt: "Entwirf die Klage für Frau Krüger-Wendt.",
        maxSteps: 5,
        tools: {
          akte_lesen: tool({ parameters: z.object({}), execute: async () => AKTE }),
          kontakt: tool({
            parameters: z.object({ person: z.string() }),
            execute: async ({ person }) => ((kontaktArg = person), `Stammdaten ${person}: geb. 14.07.1983`),
          }),
        },
      }),
    );
    expect(prompts).toHaveLength(3);
    gesehenOhnePii(prompts);
    expect(kontaktArg).toMatch(/Krüger-Wendt/);
    expect(r.text).toMatch(/Entwurf für .*Krüger-Wendt/);
    expect(r.text).not.toMatch(/\[\[/);
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
    // System prompt and earlier messages are not re-sent to anymize in every step
    expect(mock.aufzeichnungen.filter((a) => a.url.endsWith("/api/anonymize")).length).toBeLessThanOrEqual(5);
  });

  it("Streaming: über Stücke verteilte Platzhalter werden korrekt zurückgeführt", async () => {
    const { konfig } = aufbau();
    const modell = new MockLanguageModelV1({
      doStream: async (opt) => {
        const ph = platzhalterIn(opt.prompt)[0] ?? "";
        const teile = ["Mandantin ", ph.slice(0, 5), ph.slice(5, 11), ph.slice(11), " klagt."];
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: simulateReadableStream({
            chunks: [...teile.map((t) => ({ type: "text-delta" as const, textDelta: t })), { type: "finish" as const, finishReason: "stop" as const, usage: USAGE }],
          }),
        };
      },
    });
    const text = await mitKiKontext({ akteId: "a" }, async () => {
      const r = streamText({ model: schuetzeModell(modell, konfig), prompt: AKTE });
      let t = "";
      for await (const d of r.textStream) t += d;
      return t;
    });
    expect(text).toMatch(/^Mandantin .*Krüger-Wendt.* klagt\.$/);
    expect(text).not.toContain("[[");
  });

  it("generateObject: zurückgeführte Werte halten das JSON gültig", async () => {
    const { konfig } = aufbau();
    const modell = new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: async (opt) => {
        const ph = platzhalterIn(opt.prompt)[0];
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: JSON.stringify({ klaeger: ph, gericht: "ArbG Köln" }) };
      },
    });
    const r = await mitKiKontext({ akteId: "a" }, () =>
      generateObject({ model: schuetzeModell(modell, konfig), schema: z.object({ klaeger: z.string(), gericht: z.string() }), prompt: AKTE }),
    );
    expect(r.object.klaeger).toMatch(/Krüger-Wendt/);
  });

  it("ohne Aktenbezug: Fremdmodell wird genutzt, aber nur mit Platzhaltern", async () => {
    const { konfig } = aufbau();
    const gesehen: LanguageModelV1CallOptions["prompt"][] = [];
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen.push(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    const r = await generateText({ model: schuetzeModell(modell, konfig), prompt: AKTE });
    expect(r.text).toBe("ok");
    expect(gesehen).toHaveLength(1);
    gesehenOhnePii(gesehen);
  });

  it("Bilder werden gesperrt", async () => {
    const { konfig } = aufbau();
    const modell = new MockLanguageModelV1({ doGenerate: async () => { throw new Error("nein"); } });
    await expect(
      mitKiKontext({ akteId: "a" }, () =>
        generateText({
          model: schuetzeModell(modell, konfig),
          messages: [{ role: "user", content: [{ type: "text", text: "Was steht da?" }, { type: "image", image: new Uint8Array([1, 2, 3]) }] }],
        }),
      ),
    ).rejects.toThrow(/Bilder und Dateien/);
  });

  it("von anymize übersehene Beteiligte: lokal ersetzt, Anfrage geht geschützt hinaus", async () => {
    const { konfig } = aufbau({ erkennt: PII.filter((w) => !w.includes("Demirta")), bekannte: ["Aylin Demirtaş"] });
    let gesehen = "";
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen = JSON.stringify(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    await mitKiKontext({ akteId: "a" }, () => generateText({ model: schuetzeModell(modell, konfig), prompt: AKTE }));
    expect(gesehen).not.toContain("Demirta");
    expect(gesehen).toMatch(/\[\[person-L[0-9A-F]{5}\]\]/);
  });

  it("unbekannter, von anymize übersehener Name mit Zusatzprüfer: Modell wird nie aufgerufen", async () => {
    const { konfig } = aufbau({
      erkennt: PII.filter((w) => !w.includes("Demirta")),
      zusatz: async (t) => ({ funde: t.includes("Aylin Demirtaş") ? ["Aylin Demirtaş"] : [] }),
    });
    let aufgerufen = false;
    const modell = new MockLanguageModelV1({ doGenerate: async () => { aufgerufen = true; throw new Error("nein"); } });
    const e = await mitKiKontext({ akteId: "a" }, () => generateText({ model: schuetzeModell(modell, konfig), prompt: AKTE })).catch((x) => x);
    expect(e).toBeInstanceOf(PipelineFehler);
    expect((e as PipelineFehler).code).toBe("PII_IM_AUSGANG");
    expect(aufgerufen).toBe(false);
  });
});

describe("Erlaubte Begriffe", () => {
  it("von anymize als Name markierte Begriffe wie Helena bleiben lesbar und blockieren nicht", async () => {
    const { konfig } = aufbau({ erkennt: [...PII, "Helena", "Kanzlei"] });
    let gesehen = "";
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen = JSON.stringify(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    await mitKiKontext({ akteId: "a" }, () =>
      generateText({ model: schuetzeModell(modell, konfig), system: "Du bist Helena, die KI-Assistenz der Kanzlei.", prompt: AKTE }),
    );
    expect(gesehen).toContain("Du bist Helena, die KI-Assistenz der Kanzlei.");
    for (const w of PII) expect(gesehen).not.toContain(w);
  });

  it("heißt eine Beteiligte Helena, gilt die Ausnahme für diese Akte nicht", async () => {
    const { konfig } = aufbau({ erkennt: ["Helena", "Helena Sommer"], bekannte: ["Helena Sommer"] });
    let gesehen = "";
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen = JSON.stringify(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    await mitKiKontext({ akteId: "b" }, () =>
      generateText({ model: schuetzeModell(modell, konfig), prompt: "Frau Helena Sommer schreibt: Helena ist mein Rufname." }),
    );
    expect(gesehen).not.toContain("Helena");
  });
});

describe("Lokale Vorab-Pseudonymisierung bekannter Werte", () => {
  it("Vorname allein in einem JSON-Werkzeugergebnis wird ersetzt, auch wenn anymize ihn übersieht", async () => {
    const { konfig } = aufbau({ erkennt: [], bekannte: ["Sabine Krüger-Wendt", "Sabine", "Krüger-Wendt", "Lindenstraße 42"] });
    const prompts: LanguageModelV1CallOptions["prompt"][] = [];
    let schritt = 0;
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        prompts.push(opt.prompt);
        schritt++;
        const basis = { rawCall: { rawPrompt: null, rawSettings: {} }, usage: USAGE };
        if (schritt === 1) return { ...basis, finishReason: "tool-calls", toolCalls: [{ toolCallType: "function", toolCallId: "t1", toolName: "akte", args: JSON.stringify({ akteId: "cm3abcdefghijklmnopqrstu" }) }] };
        return { ...basis, finishReason: "stop", text: "fertig" };
      },
    });
    let idArg = "";
    await mitKiKontext({ akteId: "a" }, () =>
      generateText({
        model: schuetzeModell(modell, konfig),
        prompt: "Lies die Akte cm3abcdefghijklmnopqrstu.",
        maxSteps: 3,
        tools: {
          akte: tool({
            parameters: z.object({ akteId: z.string() }),
            execute: async ({ akteId }) => ((idArg = akteId), { mandant: { vorname: "Sabine", nachname: "Krüger-Wendt", strasse: "Lindenstraße 42" } }),
          }),
        },
      }),
    );
    expect(idArg).toBe("cm3abcdefghijklmnopqrstu");
    const alles = JSON.stringify(prompts);
    expect(alles).not.toContain("Sabine");
    expect(alles).not.toContain("Krüger");
    expect(alles).not.toContain("Lindenstraße");
  });
});

describe("JSON-Zeilenumbrüche (live beobachtet)", () => {
  it("bekannte Werte nach einem maskierten Zeilenumbruch werden lokal ersetzt", async () => {
    const { DatenschutzSchleuse } = await import("@/lib/helena/datei-pipeline/schleuse");
    const s = new DatenschutzSchleuse({} as never, { bekannteWerte: ["sabine.krueger-wendt@beispielmail.de", "50674 Köln", "Rheinland Logistik Hoffmann GmbH"] });
    const json = JSON.stringify({ t: "E-Mail:\nsabine.krueger-wendt@beispielmail.de, 50674\nKöln, bei der Rheinland Logistik\nHoffmann GmbH" });
    const r = s.lokalPseudonymisieren(json);
    expect(r).not.toMatch(/sabine|50674|Hoffmann/);
    expect(JSON.parse(r).t).toContain("E-Mail:\n[[email-L");
  });
});

describe("Technische Konstanten und Gerichtstypen", () => {
  it("von anymize markierte Konstanten und Gerichtstypen blockieren nicht und bleiben lesbar", async () => {
    const { konfig } = aufbau({ erkennt: [...PII, "ERSTINSTANZ", "REVISION", "Arbeitsgericht"] });
    let gesehen = "";
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen = JSON.stringify(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    await mitKiKontext({ akteId: "a" }, () =>
      generateText({
        model: schuetzeModell(modell, konfig),
        system: "Instanz: ERSTINSTANZ oder REVISION. Zuständig ist das Arbeitsgericht.",
        prompt: AKTE,
        tools: { t: tool({ description: "Instanz ERSTINSTANZ, REVISION; Gericht: Arbeitsgericht", parameters: z.object({}) }) },
      }),
    );
    expect(gesehen).toContain("ERSTINSTANZ oder REVISION");
    expect(gesehen).toContain("Arbeitsgericht");
    for (const w of PII) expect(gesehen).not.toContain(w);
  });

  it("ein Name in Großbuchstaben im Dokument bleibt geschützt (keine Konstante aus dem Code)", async () => {
    const { konfig } = aufbau({ erkennt: ["SCHMIDT"] });
    let gesehen = "";
    const modell = new MockLanguageModelV1({
      doGenerate: async (opt) => {
        gesehen = JSON.stringify(opt.prompt);
        return { rawCall: { rawPrompt: null, rawSettings: {} }, finishReason: "stop", usage: USAGE, text: "ok" };
      },
    });
    await mitKiKontext({ akteId: "c" }, () =>
      generateText({ model: schuetzeModell(modell, konfig), prompt: "Rubrum: Zeuge SCHMIDT, Instanz REVISION", tools: { t: tool({ description: "Instanz REVISION", parameters: z.object({}) }) } }),
    );
    expect(gesehen).not.toContain("SCHMIDT");
  });
});

describe("Generate über Stream (anymize-Gateway-Limit)", () => {
  it("generateObject wird intern gestreamt, Codeblock-Rahmen entfernt, Werte zurückgeführt", async () => {
    const { konfig } = aufbau();
    let generateAufgerufen = false;
    const modell = new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: async () => { generateAufgerufen = true; throw new Error("darf nicht aufgerufen werden"); },
      doStream: async (opt) => {
        const ph = platzhalterIn(opt.prompt)[0] ?? "";
        const json = "```json\n" + JSON.stringify({ klaeger: ph, gericht: "Arbeitsgericht Köln" }) + "\n```";
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: simulateReadableStream({
            chunks: [
              { type: "text-delta" as const, textDelta: json.slice(0, 20) },
              { type: "text-delta" as const, textDelta: json.slice(20) },
              { type: "finish" as const, finishReason: "stop" as const, usage: USAGE },
            ],
          }),
        };
      },
    });
    const r = await mitKiKontext({ akteId: "s" }, () =>
      generateObject({ model: schuetzeModell(modell, { ...konfig, immerStreamen: true }), schema: z.object({ klaeger: z.string(), gericht: z.string() }), prompt: AKTE }),
    );
    expect(generateAufgerufen).toBe(false);
    expect(r.object.klaeger).toMatch(/Krüger-Wendt/);
    expect(r.object.gericht).toBe("Arbeitsgericht Köln");
  });
});

describe("Fehlerereignis mitten im Stream", () => {
  const strom = (mitAntwort: boolean) =>
    new MockLanguageModelV1({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: simulateReadableStream({
          chunks: [
            { type: "error" as const, error: { message: "temporarily unavailable", type: "api_error", code: "upstream_error" } },
            ...(mitAntwort ? [{ type: "text-delta" as const, textDelta: "Antwort nach Wiederholung" }] : []),
            { type: "finish" as const, finishReason: "stop" as const, usage: USAGE },
          ],
        }),
      }),
    });
  it("Fehlerereignis gefolgt von Antwort: Antwort zählt", async () => {
    const { konfig } = aufbau();
    const r = await mitKiKontext({ akteId: "f" }, () => generateText({ model: schuetzeModell(strom(true), { ...konfig, immerStreamen: true }), prompt: "Hallo" }));
    expect(r.text).toBe("Antwort nach Wiederholung");
  });
  it("Fehlerereignis ohne Antwort: Fehler mit Typ und Code, ohne Text", async () => {
    const { konfig } = aufbau();
    const e = await mitKiKontext({ akteId: "f" }, () => generateText({ model: schuetzeModell(strom(false), { ...konfig, immerStreamen: true }), prompt: "Hallo", maxRetries: 0 })).catch((x) => x);
    expect(String(e.message)).toMatch(/api_error, upstream_error/);
    expect(String(e.message)).not.toMatch(/temporarily/);
  });
});
