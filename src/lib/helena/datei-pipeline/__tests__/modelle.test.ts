import { describe, it, expect } from "vitest";
import {
  AUFGABEN,
  POSITIVLISTE,
  STANDARD_ROUTING,
  erlaubteStandorte,
  routingAusEinstellung,
  waehleModell,
  modellEintrag,
} from "../modelle";
import { anymizeLlmVerarbeiter, systemPromptFuer } from "../verarbeiter";

describe("Positivliste", () => {
  it("enthält keine ausdrücklich ausgeschlossenen Modelle", () => {
    const ids = POSITIVLISTE.map((m) => m.id);
    for (const verboten of ["auto", "zai/glm-5.2", "x-ai/grok-4.7", "perplexity/sonar-reasoning-pro", "anthropic/claude-fable-5.1", "anthropic/claude-opus-5.5-us"]) {
      expect(ids).not.toContain(verboten);
    }
  });
  it("nur fountain/waterfall gelten als deutsch", () => {
    for (const m of POSITIVLISTE) expect(m.standort === "anymize-de").toBe(/^(fountain|waterfall)-/.test(m.id));
  });
  it("Verarbeiter verweigert Modelle außerhalb der Liste", () => {
    expect(() => anymizeLlmVerarbeiter({ apiKey: "x", modell: "auto" })).toThrow(/Positivliste/);
    expect(() => anymizeLlmVerarbeiter({ apiKey: "x", modell: "zai/glm-5.2" })).toThrow(/Positivliste/);
  });
  it("jede Aufgabe hat ein gelistetes Modell und einen deutschen Ersatz", () => {
    for (const a of AUFGABEN) {
      expect(modellEintrag(STANDARD_ROUTING[a].modell)).toBeDefined();
      expect(modellEintrag(STANDARD_ROUTING[a].ersatz)?.standort).toBe("anymize-de");
    }
  });
});

describe("Einwilligung und Auswahl", () => {
  it("ohne Einwilligung nichts, außer die Pflicht ist abgeschaltet", () => {
    expect(erlaubteStandorte("KEINE", true)).toEqual([]);
    expect(erlaubteStandorte("KEINE", false)).toEqual(["lokal", "anymize-de"]);
  });
  it("Schriftsatz: Opus nur mit Einwilligung in Fremdmodelle, sonst waterfall", () => {
    expect(waehleModell("schriftsatz", erlaubteStandorte("FREMDMODELLE", true))).toMatchObject({ modell: { id: "anthropic/claude-opus-5.5" }, ersatzGenutzt: false });
    expect(waehleModell("schriftsatz", erlaubteStandorte("DE_MODELLE", true))).toMatchObject({ modell: { id: "waterfall-2.0" }, ersatzGenutzt: true });
    expect(waehleModell("schriftsatz", [])).toBeNull();
  });
  it("Extraktion bleibt immer beim deutschen Modell", () => {
    expect(waehleModell("extrahieren", erlaubteStandorte("FREMDMODELLE", true))?.modell.id).toBe("waterfall-2.0");
  });
});

describe("Routing aus Einstellung", () => {
  it("übernimmt gültige Einträge", () => {
    const { routing, verworfen } = routingAusEinstellung({ zusammenfassen: { modell: "anthropic/claude-sonnet-5.5", ersatz: "waterfall-2.0" } });
    expect(routing.zusammenfassen.modell).toBe("anthropic/claude-sonnet-5.5");
    expect(verworfen).toEqual([]);
  });
  it("verwirft nicht gelistete Modelle, nicht-deutschen Ersatz und unbekannte Aufgaben", () => {
    const { routing, verworfen } = routingAusEinstellung({
      zusammenfassen: { modell: "auto" },
      schriftsatz: { modell: "anthropic/claude-opus-5.5", ersatz: "anthropic/claude-haiku-5.5" },
      foo: { modell: "fountain-2.0" },
    });
    expect(routing.zusammenfassen).toEqual(STANDARD_ROUTING.zusammenfassen);
    expect(routing.schriftsatz).toEqual(STANDARD_ROUTING.schriftsatz);
    expect(verworfen.sort()).toEqual(["foo", "schriftsatz", "zusammenfassen"]);
  });
});

describe("Systemprompt je Aufgabe", () => {
  it("hängt die Aufgabenanweisung an", () => {
    expect(systemPromptFuer("schriftsatz")).toContain("[FEHLT:");
    expect(systemPromptFuer("allgemein")).not.toContain("Aufgabe:");
  });
});
