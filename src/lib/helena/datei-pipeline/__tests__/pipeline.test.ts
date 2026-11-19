/**
 * Acceptance tests for the Helena Datei-Pipeline.
 *
 * Central criterion (automatic check): for every sample file, NO personal
 * value from personendaten.json appears in any request leaving the process,
 * except the documented anonymisation request to anymize itself.
 * Requests are recorded at fetch level, including the LLM call.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { AnymizeClient } from "../anymize-client";
import { verarbeiteDateien, type SicheresLog } from "../pipeline";
import { anymizeLlmVerarbeiter, aiSdkVerarbeiter, type Verarbeiter } from "../verarbeiter";
import { PipelineFehler, type EingangsDatei } from "../types";
import { erstelleAnymizeMock, findeLecks, BASIS, type MockOptionen } from "./anymize-mock";

const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;
const DATEIEN = readdirSync(DIR).filter((f) => !f.endsWith(".json") && f !== "quelle.md" && !f.startsWith("scan-"));

const AUFTRAG = "Fasse den Sachverhalt für Frau Krüger-Wendt zusammen und nenne die Klagefrist.";

function datei(name: string): EingangsDatei {
  // File name itself carries a name: it must never leave the process.
  return { daten: readFileSync(path.join(DIR, name)), dateiname: `Kündigung Krüger-Wendt ${name}` };
}

function aufbau(mockOpt: Partial<MockOptionen> = {}) {
  const mock = erstelleAnymizeMock({ erkennt: PII, pollsBisFertig: 1, ...mockOpt });
  const anymize = new AnymizeClient({ apiKey: "ANYM_test", baseUrl: BASIS, fetchImpl: mock.fetchImpl, schlafen: async () => {} });
  const verarbeiter = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, fetchImpl: mock.fetchImpl, schlafen: async () => {} });
  const logs: unknown[] = [];
  const log: SicheresLog = { info: (o, m) => logs.push({ o, m }), warn: (o, m) => logs.push({ o, m }) };
  return { mock, anymize, verarbeiter, logs, log };
}

const llmAufrufe = (m: ReturnType<typeof erstelleAnymizeMock>) =>
  m.aufzeichnungen.filter((a) => a.url.endsWith("/api/v1/llm/chat/completions"));

async function fehlerVon(p: Promise<unknown>): Promise<PipelineFehler> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(PipelineFehler);
    return e as PipelineFehler;
  }
  throw new Error("Pipeline hätte fehlschlagen müssen");
}

function ohnePii(x: unknown) {
  const s = JSON.stringify(x);
  for (const w of PII) expect(s, `"${w}" darf nicht enthalten sein`).not.toContain(w);
}

// ---------------------------------------------------------------------------

describe("Akzeptanz: keine Personendaten nach außen, je Dateiformat", () => {
  it.each(DATEIEN)("%s", async (name) => {
    const { mock, anymize, verarbeiter, logs, log } = aufbau();
    const d = datei(name);
    const r = await verarbeiteDateien({ dateien: [d], auftrag: AUFTRAG, anymize, verarbeiter, log });

    // 1. The automatic check
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
    // 2. The LLM was actually called and saw placeholders
    expect(llmAufrufe(mock)).toHaveLength(1);
    expect(llmAufrufe(mock)[0].body).toMatch(/\[\[person-[0-9A-F]{6}\]\]/);
    // 3. Rückführung restored the names locally
    expect(r.ergebnis).toContain("Krüger-Wendt");
    expect(r.ergebnisAnonymisiert).not.toContain("Krüger-Wendt");
    expect(r.protokoll.offenePlatzhalter).toBe(0);
    // 4. anymize job deleted, nothing left
    expect(r.protokoll.anymizeJobsGeloescht).toBe(true);
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
    // 5. Raw bytes zeroed, logs free of PII
    expect(d.daten.every((b) => b === 0)).toBe(true);
    ohnePii(logs);
    expect(r.protokoll.guardOk).toBe(true);
  });

  it("mehrere Dateien in einem Auftrag", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    const r = await verarbeiteDateien({
      dateien: [datei("akte-pandoc.docx"), datei("email-mandantin.eml"), datei("mandantenliste.csv")],
      auftrag: AUFTRAG,
      anymize,
      verarbeiter,
    });
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
    expect(llmAufrufe(mock)[0].body).toContain("Dokument 3 von 3 (CSV)");
    expect(r.protokoll.hinweise.join(" ")).toContain("Anhang");
  });

  it("Dateiname wird nie übertragen, auch nicht an anymize", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    await verarbeiteDateien({ dateien: [{ daten: Buffer.from("Testtext ohne Namen."), dateiname: "Akte Pakulla geheim.txt" }], auftrag: "Kurz zusammenfassen.", anymize, verarbeiter });
    expect(mock.aufzeichnungen.some((a) => a.body.includes("Pakulla") || a.url.includes("Pakulla"))).toBe(false);
  });
});

describe("Zweite Verteidigungslinie: Egress-Guard stoppt, was anymize übersieht", () => {
  it("übersehener Name, bekannt aus der Akte (Beteiligte) -> gestoppt", async () => {
    const { mock, anymize, verarbeiter, logs, log } = aufbau({ erkennt: PII.filter((w) => !w.includes("Demirta")) });
    const f = await fehlerVon(
      verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter, log, bekannteWerte: ["Aylin Demirtaş"] }),
    );
    expect(f.code).toBe("PII_IM_AUSGANG");
    expect(llmAufrufe(mock)).toHaveLength(0);
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
    expect(f.protokoll?.guardFunde[0]).toMatchObject({ kategorie: "BEKANNTER_WERT" });
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
    ohnePii([f.message, f.protokoll, logs]);
  });

  it("übersehener Nachname allein, Vollname wurde erkannt -> gestoppt (Namensteile)", async () => {
    // anymize replaced "Matthias Oberländer" but the text also has "Oberländers" on its own.
    const { mock, anymize, verarbeiter } = aufbau({ erkennt: ["Matthias Oberländer"] });
    const f = await fehlerVon(
      verarbeiteDateien({
        dateien: [{ daten: Buffer.from("Herr Matthias Oberländer kündigte. Oberländers Schreiben liegt vor."), dateiname: "x.txt" }],
        auftrag: "Zusammenfassen.",
        anymize,
        verarbeiter,
      }),
    );
    expect(f.code).toBe("PII_IM_AUSGANG");
    expect(llmAufrufe(mock)).toHaveLength(0);
  });

  it("übersehene E-Mail, IBAN, Telefon, Anschrift -> gestoppt per Muster", async () => {
    const nurNamen = ["Sabine Krüger-Wendt", "Krüger-Wendt", "Matthias Oberländer", "Jürgen Pakulla", "Aylin Demirtaş", "Rheinland Logistik Hoffmann GmbH"];
    const { mock, anymize, verarbeiter } = aufbau({ erkennt: nurNamen });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.pdf")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("PII_IM_AUSGANG");
    const kategorien = new Set(f.protokoll?.guardFunde.map((g) => g.kategorie));
    for (const k of ["EMAIL", "IBAN", "TELEFON", "STRASSE_HAUSNUMMER", "PLZ_ORT", "GEBURTSDATUM", "STEUER_ID"]) {
      expect(kategorien.has(k as never), k).toBe(true);
    }
    expect(llmAufrufe(mock)).toHaveLength(0);
  });

  it("unbekannter Name ohne Aktenbezug wird vom lokalen NER-Zusatzprüfer gestoppt", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ erkennt: PII.filter((w) => !w.includes("Demirta")) });
    const f = await fehlerVon(
      verarbeiteDateien({
        dateien: [datei("akte.md")],
        auftrag: AUFTRAG,
        anymize,
        verarbeiter,
        // stands in for runNerFilter (local Ollama) in production
        zusatzPruefer: async (t) => ({ funde: t.includes("Aylin Demirtaş") ? ["Aylin Demirtaş"] : [] }),
      }),
    );
    expect(f.code).toBe("PII_IM_AUSGANG");
    expect(f.protokoll?.guardFunde[0].kategorie).toBe("ZUSATZPRUEFER");
    expect(llmAufrufe(mock)).toHaveLength(0);
  });

  it("RESTRISIKO dokumentiert: unbekannter Name ohne Aktenbezug und ohne NER geht durch", async () => {
    // This test pins down the known limit: without Beteiligte list and without
    // local NER, a name anymize misses cannot be detected by pattern rules.
    const { mock, anymize, verarbeiter } = aufbau({ erkennt: PII.filter((w) => !w.includes("Demirta")) });
    await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter });
    expect(findeLecks(mock.ausgehendOhneAnonymize, ["Aylin Demirtaş"])).not.toEqual([]);
  });

  it("Fehler im Zusatzprüfer -> fail closed", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    const f = await fehlerVon(
      verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter, zusatzPruefer: async () => { throw new Error("ollama down"); } }),
    );
    expect(f.code).toBe("PRUEFER_FEHLER");
    expect(llmAufrufe(mock)).toHaveLength(0);
  });
});

describe("Fehlerfälle (Betrieb)", () => {
  it("falscher API-Key -> Abbruch, kein KI-Aufruf", async () => {
    const { mock, verarbeiter } = aufbau();
    const anymize = new AnymizeClient({ apiKey: "ANYM_falsch", baseUrl: BASIS, fetchImpl: mock.fetchImpl, schlafen: async () => {} });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("ANYMIZE_invalid_api_key");
    expect(llmAufrufe(mock)).toHaveLength(0);
  });

  it("Serverfehler mit Echo des Textes -> Fehlermeldung ohne Inhalt", async () => {
    const { mock, anymize, verarbeiter, logs, log } = aufbau({ anonymizeStatus: 500 });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter, log }));
    expect(f.code).toBe("ANYMIZE_boom");
    ohnePii([f.message, f.protokoll, logs, String(f.stack)]);
    expect(llmAufrufe(mock)).toHaveLength(0);
  });

  it("Rate-Limit 429 -> Wiederholung nach Retry-After, dann Erfolg", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ rateLimitErsteN: 2 });
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter });
    expect(r.protokoll.guardOk).toBe(true);
    expect(mock.aufzeichnungen.filter((a) => a.url.endsWith("/api/anonymize"))).toHaveLength(3);
  });

  it("Job schlägt fehl -> Abbruch, Job wird trotzdem gelöscht", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ jobFehlschlag: true });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("ANYMIZE_JOB_FEHLGESCHLAGEN");
    expect(mock.aufzeichnungen.some((a) => a.methode === "DELETE")).toBe(true);
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
  });

  it("Zeitüberschreitung beim Polling -> Abbruch und Löschung", async () => {
    const { mock, verarbeiter } = aufbau({ pollsBisFertig: 1000 });
    let jetzt = Date.now();
    const realNow = Date.now;
    Date.now = () => jetzt;
    try {
      const anymize = new AnymizeClient({ apiKey: "ANYM_test", baseUrl: BASIS, fetchImpl: mock.fetchImpl, jobTimeoutMs: 10_000, schlafen: async (ms) => { jetzt += ms; } });
      const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
      expect(f.code).toBe("ANYMIZE_ZEITUEBERSCHREITUNG");
    } finally {
      Date.now = realNow;
    }
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
  });

  it("Löschen bei anymize scheitert -> im Protokoll sichtbar, mit Job-ID zum Nachholen", async () => {
    const { anymize, verarbeiter } = aufbau({ loeschenFehlschlag: true });
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter });
    expect(r.protokoll.anymizeJobsGeloescht).toBe(false);
    expect(r.protokoll.nichtGeloeschteJobs).toEqual(["job_1"]);
    expect(r.protokoll.hinweise.join(" ")).toContain("nachholen");
  });

  it("KI-Anbieter fällt aus -> KI_FEHLER, Jobs gelöscht", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ llmStatus: 400 });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("KI_FEHLER");
    expect([...mock.jobs.values()].every((j) => j.geloescht)).toBe(true);
  });

  it("Scan ohne Textebene und ohne lokales OCR -> OCR_ERFORDERLICH, nichts verlässt den Prozess", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("scan-ohne-textebene.pdf")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("OCR_ERFORDERLICH");
    expect(mock.aufzeichnungen).toHaveLength(0);
  });

  it("Scan mit lokalem OCR-Anbieter wird verarbeitet", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    const r = await verarbeiteDateien({
      dateien: [datei("scan-ohne-textebene.pdf")],
      auftrag: AUFTRAG,
      anymize,
      verarbeiter,
      ocr: { texterkennung: async () => readFileSync(path.join(DIR, "akte.txt"), "utf8") },
    });
    expect(r.protokoll.ocr).toBe(true);
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
  });

  it("leere, zu große und unbekannte Binärdateien werden vor jedem Versand abgelehnt", async () => {
    const { mock, anymize, verarbeiter } = aufbau();
    const leer = await fehlerVon(verarbeiteDateien({ dateien: [{ daten: Buffer.alloc(0), dateiname: "a.txt" }], auftrag: "x", anymize, verarbeiter }));
    expect(leer.code).toBe("DATEI_LEER");
    const gross = await fehlerVon(verarbeiteDateien({ dateien: [{ daten: Buffer.alloc(26 * 1024 * 1024, 65), dateiname: "a.txt" }], auftrag: "x", anymize, verarbeiter }));
    expect(gross.code).toBe("DATEI_ZU_GROSS");
    const bin = await fehlerVon(verarbeiteDateien({ dateien: [{ daten: Buffer.from([0, 1, 2, 3, 0, 5]), dateiname: "a.bin" }], auftrag: "x", anymize, verarbeiter }));
    expect(bin.code).toBe("FORMAT_NICHT_UNTERSTUETZT");
    expect(mock.aufzeichnungen).toHaveLength(0);
  });
});

describe("Fremdanbieter-Modelle", () => {
  it("bekommen nur Platzhalter", async () => {
    const { mock, anymize } = aufbau();
    const us = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, modell: "anthropic/claude-opus-5.5", fetchImpl: mock.fetchImpl });
    expect(us.standort).toBe("fremdanbieter");
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter: us });
    expect(r.protokoll.guardOk).toBe(true);
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
  });
});

describe("Rückführung und Zero Data Retention", () => {
  it("vom Modell verstümmelte Platzhalter werden trotzdem zurückgeführt", async () => {
    const { anymize, verarbeiter: _v, mock } = aufbau({
      llmAntwort: (n) => {
        const ph = (n.match(/\[\[person-[0-9A-F]{6}\]\]/g) ?? [])[0] ?? "";
        return `A: ${ph} B: ${ph.slice(1, -1)} C: ${ph.slice(2, -2).toLowerCase()}`;
      },
    });
    const verarbeiter = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, fetchImpl: mock.fetchImpl });
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter });
    expect(r.protokoll.offenePlatzhalter).toBe(0);
    expect(r.ergebnis).not.toMatch(/Person-/i);
  });

  it("ZDR aktiv: keine Zuordnung, Ergebnis bleibt mit Platzhaltern, Hinweis im Protokoll", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ zdr: true });
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter, bekannteWerte: PII });
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
    expect(r.protokoll.ersetzungen).toBe(0);
    expect(r.protokoll.offenePlatzhalter).toBeGreaterThan(0);
    expect(r.protokoll.hinweise.join(" ")).toContain("Zero Data Retention");
  });

  it("lokaler Verarbeiter (Ollama-Stellvertreter) bekommt nur Platzhalter", async () => {
    const { mock, anymize } = aufbau();
    let gesehen = "";
    const lokal: Verarbeiter = { name: "ollama", standort: "lokal", verarbeite: async ({ nutzer }) => ((gesehen = nutzer), "ok") };
    await verarbeiteDateien({ dateien: [datei("akte-textutil.odt")], auftrag: AUFTRAG, anymize, verarbeiter: lokal });
    for (const w of PII) expect(gesehen).not.toContain(w);
    expect(mock.aufzeichnungen.every((a) => a.url.startsWith(BASIS))).toBe(true);
  });

  it("aiSdkVerarbeiter ist mit beliebigem LanguageModel nutzbar", () => {
    expect(aiSdkVerarbeiter({} as never, "x", "lokal").standort).toBe("lokal");
  });
});

describe("Denkmodelle und Streaming (live beobachtet 2026-11-19)", () => {
  it("Denkschritte werden verworfen, nur der Antworttext zählt", async () => {
    const { anymize, verarbeiter } = aufbau();
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter, aufgabe: "zusammenfassen" });
    expect(r.ergebnisAnonymisiert).not.toContain("Ich denke nach");
    expect(r.ergebnis).toContain("Zusammenfassung");
    expect(r.protokoll.nutzung).toMatchObject({ tokensEin: 10, tokensAus: 5 });
  });

  it("reasoning_effort nur für anymize-eigene Modelle, Stufe je Aufgabe", async () => {
    const { mock, anymize } = aufbau();
    const de = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, modell: "fountain-2.0", fetchImpl: mock.fetchImpl });
    await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter: de, aufgabe: "schriftsatz" });
    const fremd = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, modell: "anthropic/claude-opus-5.5", fetchImpl: mock.fetchImpl });
    await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter: fremd, aufgabe: "schriftsatz" });
    const [a, b] = llmAufrufe(mock).map((x) => JSON.parse(x.body));
    expect(a).toMatchObject({ model: "fountain-2.0", stream: true, reasoning_effort: "medium" });
    expect(b.reasoning_effort).toBeUndefined();
  });

  it("Denkmodell erreicht Token-Limit ohne Antwort -> KI_FEHLER mit klarem Hinweis", async () => {
    const { mock, anymize } = aufbau({ nurDenken: true });
    const fountain = anymizeLlmVerarbeiter({ apiKey: "ANYM_test", baseUrl: BASIS, modell: "fountain-2.0", fetchImpl: mock.fetchImpl });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter: fountain, aufgabe: "schriftsatz" }));
    expect(f.code).toBe("KI_FEHLER");
    expect(f.protokoll?.hinweise.join(" ")).toContain("Token-Limit");
    // with low effort it answers
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter: fountain, aufgabe: "extrahieren" });
    expect(r.ergebnis.length).toBeGreaterThan(0);
  });
});

describe("Vorübergehende Anbieterfehler", () => {
  it("einmal HTTP 504 -> eine Wiederholung, dann Erfolg", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ llm504ErsteN: 1 });
    const r = await verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter });
    expect(r.protokoll.guardOk).toBe(true);
    expect(llmAufrufe(mock)).toHaveLength(2);
    expect(findeLecks(mock.ausgehendOhneAnonymize, PII)).toEqual([]);
  });
  it("zweimal HTTP 504 -> KI_FEHLER, keine Endlosschleife", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ llm504ErsteN: 5 });
    const f = await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(f.code).toBe("KI_FEHLER");
    expect(llmAufrufe(mock)).toHaveLength(2);
  });
  it("HTTP 400 wird nicht wiederholt", async () => {
    const { mock, anymize, verarbeiter } = aufbau({ llmStatus: 400 });
    await fehlerVon(verarbeiteDateien({ dateien: [datei("akte.md")], auftrag: AUFTRAG, anymize, verarbeiter }));
    expect(llmAufrufe(mock)).toHaveLength(1);
  });
});
