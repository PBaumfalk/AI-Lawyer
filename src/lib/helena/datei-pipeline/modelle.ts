/**
 * Model governance for the Datei-Pipeline.
 *
 * - POSITIVLISTE: only models listed here can ever be used (new anymize models
 *   are blocked until someone adds them here via code review).
 * - Each model has a Standort class:
 *     "anymize-de"     anymize's own models, hosted at Hetzner/OVH in Germany,
 *                      sub-processors bound under § 203 Abs. 4 StGB (anymize Anlage 2)
 *     "fremdanbieter"  foundation models routed by anymize to Anthropic, Mistral, ...;
 *                      NOT bound under § 203 Abs. 4 StGB (anymize Anlage 2 § 1)
 * - AUFGABEN map a task type to a preferred model plus a German fallback,
 *   used when the Mandant's consent does not cover the preferred model.
 *
 * Deliberately NOT listed (2026-11-19 model list): "auto" (routing not
 * controllable), zai/* (China), x-ai/*, perplexity/* (web search),
 * claude-fable-5.1 (30 days retention at Anthropic per anymize), *-us variants,
 * preview models.
 */

import type { Standort } from "./verarbeiter";

export interface ModellEintrag {
  id: string;
  anbieter: string;
  standort: Exclude<Standort, "lokal">;
  /** EUR per 1M tokens (input/output) from anymize's price list, if published. */
  preis?: { ein: number; aus: number };
  /** Accepts `reasoning_effort` (anymize docs: only certain own models; verified live for fountain-2.0). */
  denkaufwand?: boolean;
}

export const POSITIVLISTE: ModellEintrag[] = [
  { id: "fountain-2.0", anbieter: "anymize", standort: "anymize-de", preis: { ein: 0.072, aus: 0.288 }, denkaufwand: true },
  { id: "waterfall-2.0", anbieter: "anymize", standort: "anymize-de", preis: { ein: 0.18, aus: 0.6 }, denkaufwand: true },
  { id: "anthropic/claude-haiku-5.5", anbieter: "Anthropic", standort: "fremdanbieter" },
  { id: "anthropic/claude-sonnet-5.5", anbieter: "Anthropic", standort: "fremdanbieter" },
  { id: "anthropic/claude-opus-5.5", anbieter: "Anthropic", standort: "fremdanbieter" },
  { id: "mistralai/mistral-large-4", anbieter: "Mistral", standort: "fremdanbieter" },
];

export function modellEintrag(id: string): ModellEintrag | undefined {
  return POSITIVLISTE.find((m) => m.id === id);
}

export const AUFGABEN = ["extrahieren", "zusammenfassen", "mandantenbrief", "schriftsatz", "wuerdigung", "allgemein"] as const;
export type Aufgabe = (typeof AUFGABEN)[number];

export const AUFGABEN_LABEL: Record<Aufgabe, string> = {
  extrahieren: "Daten, Fristen, Beteiligte herausziehen",
  zusammenfassen: "Sachstand, Zusammenfassung",
  mandantenbrief: "Mandantenbrief, Vermerk",
  schriftsatz: "Schriftsatzentwurf",
  wuerdigung: "Rechtliche Würdigung, Erfolgsaussichten",
  allgemein: "Sonstiges",
};

export interface Route {
  modell: string;
  /** German fallback when consent does not cover `modell`. */
  ersatz: string;
}

export const STANDARD_ROUTING: Record<Aufgabe, Route> = {
  extrahieren: { modell: "waterfall-2.0", ersatz: "waterfall-2.0" }, // Modellvergleich 2026-11-19: Note 5
  zusammenfassen: { modell: "waterfall-2.0", ersatz: "waterfall-2.0" },
  mandantenbrief: { modell: "waterfall-2.0", ersatz: "waterfall-2.0" },
  schriftsatz: { modell: "anthropic/claude-opus-5.5", ersatz: "waterfall-2.0" },
  wuerdigung: { modell: "anthropic/claude-opus-5.5", ersatz: "waterfall-2.0" },
  allgemein: { modell: "waterfall-2.0", ersatz: "waterfall-2.0" },
};

/** Mirrors the Prisma enum KiEinwilligung. */
export type Einwilligung = "KEINE" | "DE_MODELLE" | "FREMDMODELLE";

export function erlaubteStandorte(e: Einwilligung, einwilligungErforderlich: boolean): Standort[] {
  if (e === "FREMDMODELLE") return ["lokal", "anymize-de", "fremdanbieter"];
  if (e === "DE_MODELLE" || !einwilligungErforderlich) return ["lokal", "anymize-de"];
  return [];
}

/**
 * Merges an admin override (JSON setting) with the defaults. Entries naming
 * models outside the Positivliste, or a fallback that is not German, are ignored.
 */
export function routingAusEinstellung(roh: unknown): { routing: Record<Aufgabe, Route>; verworfen: string[] } {
  const routing = { ...STANDARD_ROUTING };
  const verworfen: string[] = [];
  if (roh && typeof roh === "object") {
    for (const [aufgabe, wert] of Object.entries(roh as Record<string, unknown>)) {
      if (!(AUFGABEN as readonly string[]).includes(aufgabe)) {
        verworfen.push(aufgabe);
        continue;
      }
      const r = wert as Partial<Route>;
      const m = typeof r?.modell === "string" ? modellEintrag(r.modell) : undefined;
      const e = typeof r?.ersatz === "string" ? modellEintrag(r.ersatz) : modellEintrag(routing[aufgabe as Aufgabe].ersatz);
      if (!m || !e || e.standort !== "anymize-de") {
        verworfen.push(aufgabe);
        continue;
      }
      routing[aufgabe as Aufgabe] = { modell: m.id, ersatz: e.id };
    }
  }
  return { routing, verworfen };
}

/** Picks the model for a task under the given consent. */
export function waehleModell(
  aufgabe: Aufgabe,
  erlaubt: Standort[],
  routing: Record<Aufgabe, Route> = STANDARD_ROUTING,
): { modell: ModellEintrag; ersatzGenutzt: boolean } | null {
  const r = routing[aufgabe];
  const bevorzugt = modellEintrag(r.modell);
  if (bevorzugt && erlaubt.includes(bevorzugt.standort)) return { modell: bevorzugt, ersatzGenutzt: false };
  const ersatz = modellEintrag(r.ersatz);
  if (ersatz && erlaubt.includes(ersatz.standort)) return { modell: ersatz, ersatzGenutzt: true };
  return null;
}

/**
 * Reasoning budget per task. Without it fountain-2.0 spent the whole token
 * budget on reasoning and never answered (observed live 2026-11-19).
 */
export const DENKAUFWAND: Record<Aufgabe, "low" | "medium" | "high"> = {
  extrahieren: "low",
  zusammenfassen: "low",
  mandantenbrief: "low",
  allgemein: "low",
  schriftsatz: "medium",
  wuerdigung: "medium",
};
