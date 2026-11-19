import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockLanguageModelV1 } from "ai/test";

let antwort: unknown = {};
let fehler = false;
let gesehenerPrompt = "";

vi.mock("@/lib/ai/provider", () => ({
  getModel: async () =>
    new MockLanguageModelV1({
      defaultObjectGenerationMode: "json",
      doGenerate: async (opt) => {
        if (fehler) throw new Error("Modell nicht erreichbar");
        gesehenerPrompt = JSON.stringify(opt.prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: "stop",
          usage: { promptTokens: 1, completionTokens: 1 },
          text: JSON.stringify(antwort),
        };
      },
    }),
}));

import { extractSlotValuesFromAuftrag } from "../answer-parser";
import { fillSlots } from "../slot-filler";
import { getKlageartDefinition } from "../klageart-registry";
import type { IntentResult } from "../schemas";

const KSCHG = getKlageartDefinition("kschg_klage");
const SLOTS = [...KSCHG.requiredSlots, ...KSCHG.optionalSlots];
const AUFTRAG =
  "Erstelle eine Kündigungsschutzklage zum Arbeitsgericht Köln. Ordentliche Kündigung vom 03.11.2026, " +
  "zugegangen am 03.11.2026. Beschäftigt seit 01.04.2015 als Disponentin, 3.850 EUR brutto.";

describe("extractSlotValuesFromAuftrag", () => {
  beforeEach(() => {
    fehler = false;
    antwort = {};
    gesehenerPrompt = "";
  });

  it("übernimmt genannte Angaben und gibt die Slot-Liste an das Modell", async () => {
    antwort = { extractedValues: { KUENDIGUNGSDATUM: "03.11.2026", BRUTTOGEHALT: "3850" } };
    const r = await extractSlotValuesFromAuftrag(AUFTRAG, SLOTS);
    expect(r).toEqual({ KUENDIGUNGSDATUM: "03.11.2026", BRUTTOGEHALT: "3850" });
    expect(gesehenerPrompt).toContain("KUENDIGUNGSDATUM");
    expect(gesehenerPrompt).toContain("Disponentin");
  });

  it("verwirft unbekannte Keys, leere Werte und Platzhalter", async () => {
    antwort = { extractedValues: { ERFUNDEN: "x", BRUTTOGEHALT: " ", ZUGANG_DATUM: "{{ZUGANG_DATUM}}", EINTRITTSDATUM: "01.04.2015" } };
    expect(await extractSlotValuesFromAuftrag(AUFTRAG, SLOTS)).toEqual({ EINTRITTSDATUM: "01.04.2015" });
  });

  it("Modellfehler führt zu keinen Werten statt zum Abbruch", async () => {
    fehler = true;
    expect(await extractSlotValuesFromAuftrag(AUFTRAG, SLOTS)).toEqual({});
  });

  it("leerer Auftrag ruft kein Modell auf", async () => {
    expect(await extractSlotValuesFromAuftrag("  ", SLOTS)).toEqual({});
    expect(gesehenerPrompt).toBe("");
  });

  it("mit allen Angaben aus dem Auftrag ist keine Rückfrage mehr nötig", async () => {
    const pflicht = Object.fromEntries(KSCHG.requiredSlots.map((s) => [s.key, "Wert"]));
    antwort = { extractedValues: pflicht };
    const ausAuftrag = await extractSlotValuesFromAuftrag(AUFTRAG, SLOTS);
    const intent = { klageart: "kschg_klage", rolle: "KLAEGER" } as IntentResult;
    const r = fillSlots(intent, ausAuftrag, {});
    expect(r.missingRequired).toEqual([]);
    expect(r.vollstaendig).toBe(true);
  });
});
