/**
 * Blind comparison: Kündigungsschutzklage drafted by Helena as an agent (tools,
 * kanzleieigenes Muster, Stammdaten) vs. the single-call pipeline, each with
 * Claude Opus 5.5 and waterfall-2.0. Fictitious data, isolated test stack.
 *
 *   DATABASE_URL=... REDIS_URL=... OLLAMA_URL=... ANYMIZE_API_KEY=... npx tsx scripts/helena-klagevergleich.ts <ausgabeOrdner>
 *
 * Requires the seed from scripts/helena-e2e.ts (Akte E2E-17/26).
 * Writes rohdaten.json (labels A-D, shuffled) and schluessel.json.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";

const echterFetch = globalThis.fetch;
const llmModelle: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("/api/v1/llm/") && typeof init?.body === "string") {
    try {
      llmModelle.push(JSON.parse(init.body).model);
    } catch {
      /* ignore */
    }
  }
  return echterFetch(input, init);
}) as typeof fetch;

const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const AUFTRAG =
  "Erstelle einen Entwurf der Kündigungsschutzklage für unsere Mandantin gegen ihre Arbeitgeberin zum Arbeitsgericht Köln. " +
  "Die Kündigung wurde ihr am 03.11.2026 persönlich übergeben; der Betrieb hat etwa 120 Arbeitnehmer.";

interface Variante {
  id: string;
  ok: boolean;
  text: string;
  fehler?: string;
  dauerS: number;
  modelle: string[];
}

async function main() {
  const KEY = process.env.ANYMIZE_API_KEY;
  if (!KEY) throw new Error("ANYMIZE_API_KEY fehlt");
  const ziel = process.argv[2] ?? "docs/modellvergleich/klage";
  mkdirSync(ziel, { recursive: true });

  const { prisma } = await import("../src/lib/db");
  const { classifyComplexity } = await import("../src/lib/helena/complexity-classifier");
  const { AnymizeClient } = await import("../src/lib/helena/datei-pipeline/anymize-client");
  const { verarbeiteDateien } = await import("../src/lib/helena/datei-pipeline/pipeline");
  const { anymizeLlmVerarbeiter } = await import("../src/lib/helena/datei-pipeline/verarbeiter");

  console.log(`Stufe laut Klassifikator: ${classifyComplexity(AUFTRAG).tier} (${classifyComplexity(AUFTRAG).reason})`);
  const akte = await prisma.akte.findUniqueOrThrow({ where: { aktenzeichen: "E2E-17/26" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "anwalt.test@example.org" } });

  const ergebnisse: Variante[] = [];
  const lauf = async (id: string, fn: () => Promise<string>) => {
    const seit = llmModelle.length;
    const t0 = Date.now();
    process.stdout.write(`${id} ... `);
    try {
      const text = await fn();
      ergebnisse.push({ id, ok: true, text, dauerS: Math.round((Date.now() - t0) / 1000), modelle: [...new Set(llmModelle.slice(seit))] });
      console.log(`ok (${Math.round((Date.now() - t0) / 1000)} s, Modelle: ${[...new Set(llmModelle.slice(seit))].join(", ")})`);
    } catch (e) {
      const f = `${(e as Error).name}: ${String((e as Error).message).slice(0, 200)}`;
      ergebnisse.push({ id, ok: false, text: "", fehler: f, dauerS: Math.round((Date.now() - t0) / 1000), modelle: [...new Set(llmModelle.slice(seit))] });
      console.log(`FEHLER ${f}`);
    }
  };

  // --- Helena's Schriftsatz-Ablauf (Muster, Gesetze, Urteile, section-wise, ERV check).
  // Rückfragen are answered the way the chat does it on follow-up turns (userSlotValues).
  const { runSchriftsatzPipeline } = await import("../src/lib/helena/schriftsatz");
  const ANTWORTEN = {
    GERICHT: "Arbeitsgericht Köln",
    KUENDIGUNGSDATUM: "03.11.2026",
    ZUGANG_DATUM: "03.11.2026",
    EINTRITTSDATUM: "01.04.2015",
    BRUTTOGEHALT: "3.850,00 EUR",
    BERUFSBEZEICHNUNG: "Disponentin",
    KUENDIGUNGSART: "ordentlich",
  };
  for (const [id, einwilligung] of [["helena-opus", "FREMDMODELLE"], ["helena-waterfall", "DE_MODELLE"]] as const) {
    await lauf(id, async () => {
      await prisma.akte.update({ where: { id: akte.id }, data: { kiEinwilligung: einwilligung } });
      const vorher = new Date();
      const r = await runSchriftsatzPipeline({
        prisma, userId: user.id, userRole: "ANWALT", userName: user.name, akteId: akte.id, message: AUFTRAG,
        userSlotValues: ANTWORTEN as never,
      });
      if (r.status !== "complete") throw new Error(`Status ${r.status}: ${JSON.stringify((r as { rueckfrage?: string; error?: string }).rueckfrage ?? (r as { error?: string }).error ?? "").slice(0, 200)}`);
      const entwurf = await prisma.helenaDraft.findFirst({ where: { akteId: akte.id, typ: "DOKUMENT", createdAt: { gte: vorher } }, orderBy: { createdAt: "desc" } });
      if (!entwurf) throw new Error("Kein Entwurf in der Akte angelegt");
      return entwurf.inhalt;
    });
  }

  // --- Single-call variants (the pipeline from the first comparison) ---
  const anymize = new AnymizeClient({ apiKey: KEY });
  for (const [id, modell] of [["einzel-opus", "anthropic/claude-opus-5.5"], ["einzel-waterfall", "waterfall-2.0"]] as const) {
    await lauf(id, async () => {
      const r = await verarbeiteDateien({
        dateien: ["akte.pdf", "email-mandantin.eml"].map((f) => ({ daten: readFileSync(path.join(DIR, f)), dateiname: f })),
        auftrag: AUFTRAG,
        aufgabe: "schriftsatz",
        anymize,
        verarbeiter: anymizeLlmVerarbeiter({ apiKey: KEY, modell }),
        erlaubteStandorte: ["anymize-de", "fremdanbieter"], // fictitious test data only
      });
      return r.ergebnis;
    });
  }

  // --- Blind labels ---
  const ids = ergebnisse.map((e) => e.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const label = Object.fromEntries(ids.map((id, i) => [id, "ABCD"[i]]));
  writeFileSync(path.join(ziel, "schluessel.json"), JSON.stringify(Object.fromEntries(ergebnisse.map((e) => [label[e.id], { variante: e.id, modelle: e.modelle }])), null, 2));
  writeFileSync(
    path.join(ziel, "rohdaten.json"),
    JSON.stringify(ergebnisse.map((e) => ({ label: label[e.id], ok: e.ok, text: e.text, fehler: e.fehler, dauerS: e.dauerS })).sort((a, b) => a.label.localeCompare(b.label)), null, 2),
  );
  console.log(`\nGeschrieben: ${ziel}/rohdaten.json, schluessel.json`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("FEHLER", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  process.exit(1);
});
