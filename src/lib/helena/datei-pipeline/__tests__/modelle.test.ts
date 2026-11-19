import { describe, it, expect } from "vitest";
import {
  AUFGABEN,
  POSITIVLISTE,
  STANDARD_ROUTING,
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
  it("jede Aufgabe hat ein gelistetes Modell", () => {
    for (const a of AUFGABEN) expect(modellEintrag(STANDARD_ROUTING[a].modell)).toBeDefined();
  });
});

describe("Auswahl", () => {
  it("Schriftsatz und Würdigung: Opus", () => {
    expect(waehleModell("schriftsatz")?.id).toBe("anthropic/claude-opus-5.5");
    expect(waehleModell("wuerdigung")?.id).toBe("anthropic/claude-opus-5.5");
  });
  it("Extraktion: waterfall", () => {
    expect(waehleModell("extrahieren")?.id).toBe("waterfall-2.0");
  });
});

describe("Routing aus Einstellung", () => {
  it("übernimmt gültige Einträge", () => {
    const { routing, verworfen } = routingAusEinstellung({ zusammenfassen: { modell: "anthropic/claude-sonnet-5.5" } });
    expect(routing.zusammenfassen.modell).toBe("anthropic/claude-sonnet-5.5");
    expect(verworfen).toEqual([]);
  });
  it("verwirft nicht gelistete Modelle und unbekannte Aufgaben", () => {
    const { routing, verworfen } = routingAusEinstellung({
      zusammenfassen: { modell: "auto" },
      foo: { modell: "fountain-2.0" },
    });
    expect(routing.zusammenfassen).toEqual(STANDARD_ROUTING.zusammenfassen);
    expect(verworfen.sort()).toEqual(["foo", "zusammenfassen"]);
  });
});

describe("Systemprompt je Aufgabe", () => {
  it("hängt die Aufgabenanweisung an", () => {
    expect(systemPromptFuer("schriftsatz")).toContain("[FEHLT:");
    expect(systemPromptFuer("allgemein")).not.toContain("Aufgabe:");
  });
});
