/**
 * Blind comparison: Kündigungsschutzklage drafted by Helena as an agent (tools,
 * kanzleieigenes Muster, Stammdaten) vs. the single-call pipeline, each with
 * Claude Opus 5.5 and waterfall-2.0. Fictitious data, isolated test stack.
 *
 *   DATABASE_URL=... REDIS_URL=... OLLAMA_URL=... ANYMIZE_API_KEY=... npx tsx scripts/helena-klagevergleich.ts <ausgabeOrdner>
 *
 * Requires the seed from scripts/helena-e2e.ts (Akte E2E-17/26).
 * LAEUFE=3 (default) runs per variant. Writes rohdaten.json (shuffled labels)
 * and schluessel.json, which also records the Rückfragen of Helena's runs.
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
  /** Helena only: slot keys asked back after the first request, and keys taken from the request. */
  rueckfragen?: string[];
  ausAuftrag?: string[];
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
  const LAEUFE = Number(process.env.LAEUFE ?? 3);
  const lauf = async (id: string, fn: () => Promise<string | { text: string; rueckfragen: string[]; ausAuftrag: string[] }>) => {
    const seit = llmModelle.length;
    const t0 = Date.now();
    process.stdout.write(`${id} ... `);
    try {
      const r = await fn();
      const extra = typeof r === "string" ? { text: r } : r;
      ergebnisse.push({ id, ok: true, ...extra, dauerS: Math.round((Date.now() - t0) / 1000), modelle: [...new Set(llmModelle.slice(seit))] });
      if (typeof r !== "string") process.stdout.write(`Rückfragen: ${r.rueckfragen.join(", ") || "keine"}; aus dem Auftrag: ${r.ausAuftrag.join(", ") || "nichts"} – `);
      console.log(`ok (${Math.round((Date.now() - t0) / 1000)} s, Modelle: ${[...new Set(llmModelle.slice(seit))].join(", ")})`);
    } catch (e) {
      const f = `${(e as Error).name}: ${String((e as Error).message).slice(0, 200)}`;
      ergebnisse.push({ id, ok: false, text: "", fehler: f, dauerS: Math.round((Date.now() - t0) / 1000), modelle: [...new Set(llmModelle.slice(seit))] });
      console.log(`FEHLER ${f}`);
    }
  };

  // --- Helena's Schriftsatz-Ablauf (Muster, Gesetze, Urteile, section-wise, ERV check).
  // First the plain request, as in the chat. Remaining Rückfragen are answered the way the
  // chat does it on follow-up turns: missing slots merged into the saved slot state.
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
  // The Schriftsatz pipeline takes its model from ai.helena.tier3_model; set it per variant, restore afterwards.
  const { getSetting, updateSetting } = await import("../src/lib/settings/service");
  const tier3Vorher = (await getSetting("ai.helena.tier3_model")) ?? "";
  const varianten = [["helena-opus", "anthropic/claude-opus-5.5"], ["helena-waterfall", "waterfall-2.0"]] as const;
  for (let n = 1; n <= LAEUFE; n++) {
    for (const [id, modell] of varianten) {
      await lauf(`${id}-${n}`, async () => {
        await updateSetting("ai.helena.tier3_model", modell);
        const vorher = new Date();
        const basis = { prisma, userId: user.id, userRole: "ANWALT" as const, userName: user.name, akteId: akte.id, message: AUFTRAG };
        let r = await runSchriftsatzPipeline(basis);
        const rueckfragen: string[] = [];
        // A complete first run carries no slot state: then everything came from the request and the Akte.
        const ausAuftrag = r.slotState ? Object.keys(ANTWORTEN).filter((k) => r.slotState?.[k] != null) : Object.keys(ANTWORTEN);
        if (r.status === "needs_input" && r.slotState) {
          const offen = Object.entries(r.slotState).filter(([, v]) => v === null).map(([k]) => k);
          rueckfragen.push(...offen.filter((k) => k in ANTWORTEN));
          const antworten = Object.fromEntries(offen.filter((k) => k in ANTWORTEN).map((k) => [k, ANTWORTEN[k as keyof typeof ANTWORTEN]]));
          r = await runSchriftsatzPipeline({ ...basis, userSlotValues: { ...r.slotState, ...antworten } });
        }
        if (r.status !== "complete") throw new Error(`Status ${r.status}: ${JSON.stringify((r as { rueckfrage?: string; error?: string }).rueckfrage ?? (r as { error?: string }).error ?? "").slice(0, 200)}`);
        const entwurf = await prisma.helenaDraft.findFirst({ where: { akteId: akte.id, typ: "DOKUMENT", createdAt: { gte: vorher } }, orderBy: { createdAt: "desc" } });
        if (!entwurf) throw new Error("Kein Entwurf in der Akte angelegt");
        return { text: entwurf.inhalt, rueckfragen, ausAuftrag };
      });
    }
  }

  await updateSetting("ai.helena.tier3_model", tier3Vorher);

  // --- Single-call variants (the pipeline from the first comparison) ---
  const anymize = new AnymizeClient({ apiKey: KEY });
  for (let n = 1; n <= LAEUFE; n++) for (const [id, modell] of [["einzel-opus", "anthropic/claude-opus-5.5"], ["einzel-waterfall", "waterfall-2.0"]] as const) {
    await lauf(`${id}-${n}`, async () => {
      const r = await verarbeiteDateien({
        dateien: ["akte.pdf", "email-mandantin.eml"].map((f) => ({ daten: readFileSync(path.join(DIR, f)), dateiname: f })),
        auftrag: AUFTRAG,
        aufgabe: "schriftsatz",
        anymize,
        verarbeiter: anymizeLlmVerarbeiter({ apiKey: KEY, modell }),
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
  const label = Object.fromEntries(ids.map((id, i) => [id, String.fromCharCode(65 + i)]));
  writeFileSync(
    path.join(ziel, "schluessel.json"),
    JSON.stringify(Object.fromEntries(ergebnisse.map((e) => [label[e.id], { variante: e.id, modelle: e.modelle, rueckfragen: e.rueckfragen, ausAuftrag: e.ausAuftrag }])), null, 2),
  );
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
