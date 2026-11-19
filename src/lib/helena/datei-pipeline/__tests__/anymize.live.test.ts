/**
 * LIVE test against the real anymize API. Runs only with ANYMIZE_API_KEY set:
 *
 *   ANYMIZE_API_KEY=ANYM_... npx vitest run src/lib/helena/datei-pipeline/__tests__/anymize.live.test.ts
 *
 * Uses only the fictitious sample data. Measures what anymize really replaces,
 * whether the local guard catches the rest, and whether job deletion works.
 * The LLM step uses a local stub (no LLM cost); set ANYMIZE_LIVE_LLM=1 to also
 * call anymize's own model (waterfall-2.0).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { AnymizeClient, AnymizeFehler } from "../anymize-client";
import { verarbeiteDateien } from "../pipeline";
import { PiiGuard } from "../pii-guard";
import { anymizeLlmVerarbeiter, type Verarbeiter } from "../verarbeiter";
import { PipelineFehler } from "../types";
import { zuMarkdown } from "../konvertieren";

const KEY = process.env.ANYMIZE_API_KEY ?? "";
const BASE = process.env.ANYMIZE_BASE_URL ?? "https://app.anymize.ai";
const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;

describe.skipIf(!KEY)("anymize LIVE", () => {
  // Created lazily: the describe body is collected even when skipped.
  const client = KEY ? new AnymizeClient({ apiKey: KEY, baseUrl: BASE }) : (null as unknown as AnymizeClient);

  it("anonymisiert die Beispielakte, Erkennungsquote und Guard-Ergebnis", async () => {
    const { markdown } = await zuMarkdown({ daten: readFileSync(path.join(DIR, "akte.md")), dateiname: "akte.md" });
    const r = await client.anonymisiere(markdown);
    try {
      const uebrig = PII.filter((w) => r.text.replace(/\s+/g, " ").includes(w));
      const funde = new PiiGuard({ originalText: markdown, paare: r.paare }).pruefeSync(r.text);
      // Report without values: only masked counts.
      console.info(
        `[anymize live] Paare: ${r.paare.length}, Platzhalterbeispiel: ${r.paare[0]?.placeholder ?? "-"}, ` +
          `nicht ersetzt (Referenzliste): ${uebrig.length}/${PII.length}, Guard-Funde: ${funde.map((f) => `${f.kategorie} ${f.maske}`).join("; ") || "keine"}`,
      );
      expect(r.text.length).toBeGreaterThan(0);
      // Whatever anymize missed must be caught by the guard (or there is nothing left).
      if (uebrig.length > 0) expect(funde.length).toBeGreaterThan(0);
    } finally {
      for (const id of r.jobIds) await client.loescheJob(id);
    }
    // After deletion, hash pairs must be gone.
    for (const id of r.jobIds) {
      const nachher = await fetch(`${BASE}/api/status/${id}/strings`, { headers: { Authorization: `Bearer ${KEY}` } });
      const body = nachher.ok ? ((await nachher.json()) as { count?: number; hash_pairs?: unknown[] }) : null;
      expect(!nachher.ok || (body?.hash_pairs ?? []).length === 0, "Hash-Paare nach Löschung noch abrufbar").toBe(true);
    }
  }, 300_000);

  it("Ende-zu-Ende über alle Formate: kein Klartext an die KI", async () => {
    const dateien = ["akte-pandoc.docx", "akte-textutil.odt", "akte.pdf", "akte.rtf", "akte.html", "email-mandantin.eml", "mandantenliste.csv"];
    for (const name of dateien) {
      let gesehen = "";
      const stub: Verarbeiter = {
        name: "stub",
        standort: "lokal",
        verarbeite: async ({ system, nutzer }) => ((gesehen = `${system}\n${nutzer}`), "Zusammenfassung folgt."),
      };
      const verarbeiter = process.env.ANYMIZE_LIVE_LLM ? anymizeLlmVerarbeiter({ apiKey: KEY, baseUrl: BASE }) : stub;
      try {
        const r = await verarbeiteDateien({
          dateien: [{ daten: readFileSync(path.join(DIR, name)), dateiname: name }],
          auftrag: "Fasse den Sachverhalt in fünf Sätzen zusammen.",
          anymize: client,
          verarbeiter,
        });
        console.info(`[anymize live] ${name}: ok, Ersetzungen ${r.protokoll.ersetzungen}, Jobs gelöscht ${r.protokoll.anymizeJobsGeloescht}`);
        for (const w of PII) expect(gesehen.replace(/\s+/g, " "), `${name}: Klartext an KI`).not.toContain(w);
        expect(r.protokoll.anymizeJobsGeloescht).toBe(true);
      } catch (e) {
        if (e instanceof PipelineFehler && e.code === "PII_IM_AUSGANG") {
          // anymize missed something and the guard stopped the run: acceptable, nothing went out.
          console.info(`[anymize live] ${name}: vom Guard gestoppt: ${e.protokoll?.guardFunde.map((f) => `${f.kategorie} ${f.maske}`).join("; ")}`);
          expect(gesehen).toBe("");
          expect(e.protokoll?.anymizeJobsGeloescht).toBe(true);
        } else throw e;
      }
    }
  }, 900_000);

  it("ungültiger Schlüssel wird sauber abgelehnt", async () => {
    const falsch = new AnymizeClient({ apiKey: "ANYM_ungueltig", baseUrl: BASE });
    await expect(falsch.anonymisiere("Test")).rejects.toBeInstanceOf(AnymizeFehler);
  });
});
