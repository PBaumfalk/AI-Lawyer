/**
 * Datenschutz-Schleuse as AI SDK middleware.
 *
 * Every external (non-Ollama) model Helena uses is wrapped with this
 * middleware (see provider.ts). It covers all callers at once: agent with
 * tools, Schriftsatz pipeline (generateObject), chat (streamText), scanner, ...
 *
 *   before a call  system/user text and tool results -> anymize (cached per run);
 *                  the model's own earlier output -> local re-pseudonymisation;
 *                  images/files -> blocked (cannot be pseudonymised);
 *                  the complete request -> egress guard (fail closed)
 *   after a call   placeholders in text and tool-call arguments -> original values,
 *                  locally (tools run on real data, users read real names);
 *                  JSON outputs get JSON-escaped values
 *   consent        per Akte (§ 43e Abs. 5 BRAO): a model the consent does not
 *                  cover is replaced by the German fallback model; no consent
 *                  at all blocks before anything is sent
 *
 * The Akte context travels via AsyncLocalStorage: wrap an entry point in
 * `mitKiKontext({ akteId }, fn)`; all model calls inside share one Schleuse,
 * i.e. one placeholder mapping.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { wrapLanguageModel, type LanguageModelV1Middleware } from "ai";
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1Prompt,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import { DatenschutzSchleuse } from "@/lib/helena/datei-pipeline/schleuse";
import type { AnymizeClient } from "@/lib/helena/datei-pipeline/anymize-client";
import { erlaubteStandorte, type Einwilligung } from "@/lib/helena/datei-pipeline/modelle";
import type { Standort } from "@/lib/helena/datei-pipeline/verarbeiter";
import { PipelineFehler, type ZusatzPruefer } from "@/lib/helena/datei-pipeline/types";
import { PLATZHALTER_REGEX } from "@/lib/helena/datei-pipeline/pii-guard";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface KiKontext {
  akteId?: string;
  schleuse?: DatenschutzSchleuse;
  bekannteWerte?: Promise<string[]>;
  einwilligung?: Promise<Einwilligung>;
}

const kontextSpeicher = new AsyncLocalStorage<KiKontext>();

/**
 * Runs `fn` with an Akte context: all model calls inside share one Schleuse.
 * An enclosing context for the same Akte is reused (one mapping per request).
 */
export function mitKiKontext<T>(kontext: { akteId?: string | null }, fn: () => T): T {
  const akteId = kontext.akteId ?? undefined;
  const aktuell = kontextSpeicher.getStore();
  if (aktuell && aktuell.akteId === akteId) return fn();
  return kontextSpeicher.run({ akteId }, fn);
}

/**
 * Sets the Akte context for the rest of the current request (route handlers
 * where the Akte is only known after parsing the body).
 */
export function setzeKiKontext(akteId: string | null | undefined): void {
  const aktuell = kontextSpeicher.getStore();
  if (aktuell && aktuell.akteId === (akteId ?? undefined)) return;
  kontextSpeicher.enterWith({ akteId: akteId ?? undefined });
}

export function aktuellerKiKontext(): { akteId?: string } | undefined {
  const k = kontextSpeicher.getStore();
  return k ? { akteId: k.akteId } : undefined;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export interface SchleusenKonfig {
  anymize: () => AnymizeClient;
  /** Where the wrapped model runs. */
  standort: Standort;
  /** German fallback (anymize-de) used when consent does not cover `standort`. */
  ersatzModell?: () => LanguageModelV1;
  einwilligungLaden: (akteId: string) => Promise<Einwilligung>;
  einwilligungErforderlich: boolean;
  bekannteWerteLaden?: (akteId: string) => Promise<string[]>;
  /** Terms that are never personal data (assistant name, legal vocabulary, own firm). */
  erlaubteBegriffe?: string[];
  zusatzPruefer?: ZusatzPruefer;
  log?: { warn(obj: object, msg: string): void };
}

/** Never personal data; anymize sometimes tags them anyway (live 2026-11-19: "Helena", "Kanzlei"). */
export const STANDARD_ERLAUBTE_BEGRIFFE = [
  "Helena", "Kanzlei", "Mandant", "Mandantin", "Mandantschaft", "Rechtsanwalt", "Rechtsanwältin",
  "Anwalt", "Anwältin", "Arbeitgeber", "Arbeitgeberin", "Arbeitnehmer", "Arbeitnehmerin", "Gegner", "Gegnerin",
];

interface Lauf {
  schleuse: DatenschutzSchleuse;
  ersatz?: LanguageModelV1;
}

const NICHT_PSEUDONYMISIERBAR = () =>
  new PipelineFehler(
    "guard",
    "NICHT_PSEUDONYMISIERBAR",
    "Bilder und Dateien lassen sich nicht pseudonymisieren und werden nicht an eine externe KI gesendet",
  );

export function schleusenMiddleware(k: SchleusenKonfig): LanguageModelV1Middleware {
  const laeufe = new WeakMap<LanguageModelV1CallOptions, Lauf>();

  return {
    async transformParams({ params }) {
      const ctx = kontextSpeicher.getStore();

      // 1. Consent, before anything leaves the process.
      let erlaubt: Standort[];
      if (ctx?.akteId) {
        ctx.einwilligung ??= k.einwilligungLaden(ctx.akteId);
        erlaubt = erlaubteStandorte(await ctx.einwilligung, k.einwilligungErforderlich);
        if (erlaubt.length === 0) {
          throw new PipelineFehler(
            "einlesen",
            "EINWILLIGUNG_FEHLT",
            "Für diese Akte ist keine Einwilligung der Mandantschaft in die KI-Verarbeitung vermerkt (§ 43e Abs. 5 BRAO)",
          );
        }
      } else {
        // No Akte context: content may still be mandate data. Only German models.
        erlaubt = ["lokal", "anymize-de"];
      }
      let ersatz: LanguageModelV1 | undefined;
      if (!erlaubt.includes(k.standort)) {
        if (!k.ersatzModell || !erlaubt.includes("anymize-de")) {
          throw new PipelineFehler("verarbeiten", "ANBIETER_NICHT_FREIGEGEBEN", "Das gewählte KI-Modell ist für diese Akte nicht freigegeben");
        }
        ersatz = k.ersatzModell();
      }

      // 2. One Schleuse per Akte context (shared mapping across agent steps).
      let schleuse: DatenschutzSchleuse;
      if (ctx) {
        if (!ctx.schleuse) {
          ctx.bekannteWerte ??= ctx.akteId && k.bekannteWerteLaden ? k.bekannteWerteLaden(ctx.akteId).catch(() => []) : Promise.resolve([]);
          ctx.schleuse = new DatenschutzSchleuse(k.anymize(), {
            bekannteWerte: await ctx.bekannteWerte,
            erlaubteWerte: [...STANDARD_ERLAUBTE_BEGRIFFE, ...(k.erlaubteBegriffe ?? [])],
            zusatzPruefer: k.zusatzPruefer,
          });
        }
        schleuse = ctx.schleuse;
      } else {
        schleuse = new DatenschutzSchleuse(k.anymize(), {
          erlaubteWerte: [...STANDARD_ERLAUBTE_BEGRIFFE, ...(k.erlaubteBegriffe ?? [])],
          zusatzPruefer: k.zusatzPruefer,
        });
      }

      // 3. Pseudonymise. First everything new (anymize), then the model's own output (local).
      const prompt = await pseudonymisierePrompt(params.prompt, schleuse);

      // 4. Egress guard over the complete request (prompt + tool definitions).
      const nutzlast = JSON.stringify({ prompt, mode: params.mode });
      const funde = await schleuse.pruefe(nutzlast);
      if (funde.length > 0) {
        k.log?.warn({ datenschutzSchleuse: { funde: funde.map((f) => ({ kategorie: f.kategorie, maske: f.maske })) } }, "Datenschutz-Schleuse: Versand gestoppt");
        throw new PipelineFehler("guard", "PII_IM_AUSGANG", `Versand gestoppt: ${funde.length} personenbezogene Angabe(n) wurden nicht pseudonymisiert`);
      }

      const neu: LanguageModelV1CallOptions = { ...params, prompt };
      laeufe.set(neu, { schleuse, ersatz });
      return neu;
    },

    async wrapGenerate({ doGenerate, params }) {
      const lauf = laeufe.get(params);
      if (!lauf) throw new PipelineFehler("guard", "UNGEPRUEFT", "Interner Fehler: Anfrage wurde nicht durch die Datenschutz-Schleuse geleitet");
      const r = lauf.ersatz ? await lauf.ersatz.doGenerate(params) : await doGenerate();
      const json = params.mode.type !== "regular";
      return {
        ...r,
        text: r.text === undefined ? undefined : lauf.schleuse.rueckfuehren(r.text, json).text,
        reasoning: typeof r.reasoning === "string" ? lauf.schleuse.rueckfuehren(r.reasoning).text : undefined,
        toolCalls: r.toolCalls?.map((t) => ({ ...t, args: lauf.schleuse.rueckfuehren(t.args, true).text })),
      };
    },

    async wrapStream({ doStream, params }) {
      const lauf = laeufe.get(params);
      if (!lauf) throw new PipelineFehler("guard", "UNGEPRUEFT", "Interner Fehler: Anfrage wurde nicht durch die Datenschutz-Schleuse geleitet");
      const r = lauf.ersatz ? await lauf.ersatz.doStream(params) : await doStream();
      const json = params.mode.type !== "regular";
      return { ...r, stream: r.stream.pipeThrough(rueckfuehrungsStrom(lauf.schleuse, json)) };
    },
  };
}

/** Wraps a model with the Schleuse. */
export function schuetzeModell(model: LanguageModelV1, konfig: SchleusenKonfig): LanguageModelV1 {
  return wrapLanguageModel({ model, middleware: schleusenMiddleware(konfig) });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pseudonymisierePrompt(prompt: LanguageModelV1Prompt, s: DatenschutzSchleuse): Promise<LanguageModelV1Prompt> {
  // Pass 1: content from outside the model (anymize, in parallel, cached).
  const ersterDurchgang = await Promise.all(
    prompt.map(async (m) => {
      switch (m.role) {
        case "system":
          return { ...m, content: await s.einlassen(m.content) };
        case "user":
          return {
            ...m,
            content: await Promise.all(
              m.content.map(async (p) => {
                if (p.type === "text") return { ...p, text: await s.einlassen(p.text) };
                throw NICHT_PSEUDONYMISIERBAR();
              }),
            ),
          };
        case "tool":
          return {
            ...m,
            content: await Promise.all(
              m.content.map(async (p) => {
                if (p.content?.some((c) => c.type !== "text")) throw NICHT_PSEUDONYMISIERBAR();
                // Readable form with real line breaks: in compact JSON a value wrapped across
                // lines ("50674\\nKöln") escapes both anymize and word-boundary matching.
                const roh = typeof p.result === "string" ? p.result : lesbar(p.result);
                return { ...p, result: await s.einlassen(roh), content: undefined };
              }),
            ),
          };
        default:
          return m;
      }
    }),
  );
  // Pass 2: the model's own earlier output, re-identified after the last step.
  return ersterDurchgang.map((m) => {
    if (m.role !== "assistant") return m;
    return {
      ...m,
      content: m.content.map((p) => {
        switch (p.type) {
          case "text":
          case "reasoning":
            return { ...p, text: s.lokalPseudonymisieren(p.text) };
          case "tool-call":
            return { ...p, args: JSON.parse(s.lokalPseudonymisieren(JSON.stringify(p.args ?? {}))) };
          case "redacted-reasoning":
            return p;
          default:
            throw NICHT_PSEUDONYMISIERBAR();
        }
      }),
    };
  }) as LanguageModelV1Prompt;
}

/**
 * Re-identifies a stream. A placeholder can be split across text deltas
 * ("[[pers" + "on-AB12]]"), so an unfinished "[[..." is held back until it closes.
 */
export function rueckfuehrungsStrom(s: DatenschutzSchleuse, json: boolean): TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart> {
  let puffer = "";
  const ausgeben = (text: string, ctrl: TransformStreamDefaultController<LanguageModelV1StreamPart>) => {
    if (text) ctrl.enqueue({ type: "text-delta", textDelta: s.rueckfuehren(text, json).text });
  };
  const leeren = (ctrl: TransformStreamDefaultController<LanguageModelV1StreamPart>) => {
    ausgeben(puffer, ctrl);
    puffer = "";
  };
  return new TransformStream({
    transform(teil, ctrl) {
      if (teil.type === "text-delta") {
        puffer += teil.textDelta;
        const offen = puffer.lastIndexOf("[[");
        const zu = offen >= 0 ? puffer.indexOf("]]", offen) : -1;
        let schnitt = puffer.length;
        if (offen >= 0 && zu < 0 && puffer.length - offen <= 120) schnitt = offen;
        else if (puffer.endsWith("[")) schnitt = puffer.length - 1;
        ausgeben(puffer.slice(0, schnitt), ctrl);
        puffer = puffer.slice(schnitt);
        return;
      }
      leeren(ctrl);
      if (teil.type === "tool-call") ctrl.enqueue({ ...teil, args: s.rueckfuehren(teil.args, true).text });
      else if (teil.type === "reasoning") ctrl.enqueue({ ...teil, textDelta: s.rueckfuehren(teil.textDelta).text });
      else ctrl.enqueue(teil);
    },
    flush(ctrl) {
      leeren(ctrl);
    },
  });
}

/** Tool result as readable, JSON-like text with real line breaks. */
export function lesbar(wert: unknown): string {
  return (JSON.stringify(wert ?? null, null, 2) ?? "null").replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, "\t");
}

/** Number of placeholders left in a text (for protocols). */
export function offenePlatzhalter(text: string): number {
  return (text.match(PLATZHALTER_REGEX) ?? []).length;
}
