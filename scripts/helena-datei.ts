/**
 * CLI for the Helena Datei-Pipeline (no database needed).
 *
 *   ANYMIZE_API_KEY=ANYM_... npx tsx scripts/helena-datei.ts --auftrag "Fasse zusammen" datei1.docx datei2.pdf
 *
 * Options:
 *   --bekannt "Name1;Name2"   known personal values for the guard (e.g. Beteiligte)
 *   --modell waterfall-2.0    anymize model (only fountain and waterfall models run in Germany)
 *   --trocken                 do not call an LLM; prints what WOULD be sent (anonymised)
 *
 * Output: result (re-identified) on stdout, protocol on stderr.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { AnymizeClient } from "../src/lib/helena/datei-pipeline/anymize-client";
import { verarbeiteDateien } from "../src/lib/helena/datei-pipeline/pipeline";
import { anymizeLlmVerarbeiter, type Verarbeiter } from "../src/lib/helena/datei-pipeline/verarbeiter";
import { PipelineFehler } from "../src/lib/helena/datei-pipeline/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = process.env.ANYMIZE_API_KEY;
  if (!key) throw new Error("ANYMIZE_API_KEY fehlt");
  const auftrag = arg("auftrag") ?? "Fasse den Inhalt zusammen.";
  const werteArgs = new Set(["--auftrag", "--bekannt", "--modell"]);
  const dateien = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !werteArgs.has(all[i - 1] ?? ""));
  if (dateien.length === 0) throw new Error("Keine Datei angegeben");

  const base = process.env.ANYMIZE_BASE_URL ?? "https://app.anymize.ai";
  const anymize = new AnymizeClient({ apiKey: key, baseUrl: base });
  let verarbeiter: Verarbeiter = anymizeLlmVerarbeiter({ apiKey: key, baseUrl: base, modell: arg("modell") });
  if (process.argv.includes("--trocken")) {
    verarbeiter = {
      name: "trocken",
      standort: "lokal",
      verarbeite: async ({ nutzer }) => `--- Das ginge an die KI (anonymisiert) ---\n${nutzer}`,
    };
  }

  try {
    const r = await verarbeiteDateien({
      dateien: dateien.map((d) => ({ daten: readFileSync(d), dateiname: path.basename(d) })),
      auftrag,
      anymize,
      verarbeiter,
      bekannteWerte: arg("bekannt")?.split(";").map((s) => s.trim()).filter(Boolean),
    });
    process.stdout.write(`${process.argv.includes("--trocken") ? r.ergebnisAnonymisiert : r.ergebnis}\n`);
    process.stderr.write(`${JSON.stringify(r.protokoll, null, 2)}\n`);
  } catch (e) {
    if (e instanceof PipelineFehler) {
      process.stderr.write(`ABBRUCH [${e.schritt}/${e.code}]: ${e.message}\n${JSON.stringify(e.protokoll ?? {}, null, 2)}\n`);
      process.exit(2);
    }
    throw e;
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
