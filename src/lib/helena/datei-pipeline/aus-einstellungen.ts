/**
 * Wires the Datei-Pipeline to SystemSettings, the Akte and local services.
 * Kept separate from the core so the core stays testable without DB.
 */

import { getSettingTyped } from "@/lib/settings/service";
import { getModel } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logger";
import { nerPruefer } from "./ner-pruefer";
import { ocrPdf, convertImageToPdf } from "@/lib/ocr/stirling-client";
import { AnymizeClient } from "./anymize-client";
import { pdfText } from "./konvertieren";
import { anymizeLlmVerarbeiter, aiSdkVerarbeiter, type Standort, type Verarbeiter } from "./verarbeiter";
import { erlaubteStandorte, routingAusEinstellung, waehleModell, type Aufgabe, type Einwilligung } from "./modelle";
import { PipelineFehler, type OcrProvider, type ZusatzPruefer } from "./types";
import type { SicheresLog } from "./pipeline";
import { einwilligungDerAkte, bekannteWerteDerAkte } from "./akte-daten";

export { einwilligungDerAkte, bekannteWerteDerAkte };

export interface Auswahl {
  aufgabe: Aufgabe;
  einwilligung: Einwilligung;
  erlaubteStandorte: Standort[];
  hinweise: string[];
}

export async function pipelineAbhaengigkeiten(o: { aufgabe: Aufgabe; einwilligung: Einwilligung }): Promise<{
  anymize: AnymizeClient;
  verarbeiter: Verarbeiter;
  ocr: OcrProvider;
  zusatzPruefer?: ZusatzPruefer;
  log: SicheresLog;
  auswahl: Auswahl;
}> {
  const apiKey = await getSettingTyped<string>("anymize.apiKey", process.env.ANYMIZE_API_KEY ?? "");
  const baseUrl = await getSettingTyped<string>("anymize.baseUrl", "https://app.anymize.ai");
  if (!apiKey) {
    throw new PipelineFehler("einlesen", "NICHT_EINGERICHTET", "anymize ist nicht eingerichtet (API-Schlüssel fehlt)");
  }
  const anymize = new AnymizeClient({ apiKey, baseUrl });

  const pflicht = await getSettingTyped<boolean>("helena.datei.einwilligungErforderlich", false);
  const erlaubt = erlaubteStandorte(o.einwilligung, pflicht);
  if (erlaubt.length === 0) {
    throw new PipelineFehler(
      "einlesen",
      "EINWILLIGUNG_FEHLT",
      "Für diese Akte ist keine Einwilligung der Mandantschaft in die KI-Verarbeitung vermerkt (Kanzleieinstellung „Einwilligung auch für deutsche Modelle“)",
    );
  }
  const hinweise: string[] = [];

  const art = await getSettingTyped<string>("helena.datei.verarbeiter", "anymize");
  let verarbeiter: Verarbeiter;
  if (art === "lokal") {
    const provider = await getSettingTyped<string>("ai.provider", "ollama");
    // "lokal" only means local if Helena's provider really is Ollama.
    verarbeiter = aiSdkVerarbeiter(await getModel(), `helena:${provider}`, provider === "ollama" ? "lokal" : "fremdanbieter");
  } else {
    const { routing, verworfen } = routingAusEinstellung(await getSettingTyped<unknown>("helena.datei.modellRouting", null));
    if (verworfen.length) hinweise.push(`Ungültige Routing-Einträge ignoriert: ${verworfen.join(", ")}`);
    const wahl = waehleModell(o.aufgabe, erlaubt, routing);
    if (!wahl) {
      throw new PipelineFehler("verarbeiten", "ANBIETER_NICHT_FREIGEGEBEN", "Für diese Aufgabe ist kein freigegebenes Modell konfiguriert");
    }
    if (wahl.ersatzGenutzt) {
      hinweise.push(`Ersatzmodell ${wahl.modell.id} genutzt, weil die Einwilligung das bevorzugte Modell nicht abdeckt`);
    }
    verarbeiter = anymizeLlmVerarbeiter({ apiKey, baseUrl, modell: wahl.modell.id });
  }

  const ocr: OcrProvider = {
    async texterkennung(daten, art) {
      // Neutral file name: the original name is personal data.
      const pdf = art === "bild" ? await convertImageToPdf(daten, "scan.png") : daten;
      return (await pdfText(await ocrPdf(pdf))).text;
    },
  };

  const nerAn = await getSettingTyped<boolean>("helena.datei.nerPruefung", true);
  const zusatzPruefer: ZusatzPruefer | undefined = nerAn ? nerPruefer : undefined;

  const pino = createLogger("helena-datei-pipeline");
  // Only the protocol object is ever passed in; it holds counts and masks, no content.
  const log: SicheresLog = { info: (o, m) => pino.info(o, m), warn: (o, m) => pino.warn(o, m) };

  return {
    anymize,
    verarbeiter,
    ocr,
    zusatzPruefer,
    log,
    auswahl: { aufgabe: o.aufgabe, einwilligung: o.einwilligung, erlaubteStandorte: erlaubt, hinweise },
  };
}

