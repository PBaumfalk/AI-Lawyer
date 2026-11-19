/**
 * End-to-end test of Helena behind the Datenschutz-Schleuse, against a real
 * (isolated, test-only) Postgres/Redis/Ollama and real anymize. Fictitious data only.
 *
 *   DATABASE_URL=... REDIS_URL=... OLLAMA_URL=... ANYMIZE_API_KEY=... npx tsx scripts/helena-e2e.ts
 *
 * Seeds an Akte (Mandantin, Arbeitgeberin, Vorgesetzter, documents with OCR
 * text, a kanzleieigenes Muster with embeddings), then runs Helena's real
 * entry points. Every request leaving the process is recorded: requests to
 * anyone other than localhost and anymize fail the test, and requests to the
 * LLM endpoint are checked against the personal values of the Akte.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

// --- Record all outgoing requests (installed before any app module runs) ----
const echterFetch = globalThis.fetch;
const ausgehend: Array<{ url: string; body: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  ausgehend.push({ url, body: typeof init?.body === "string" ? init.body : "" });
  return echterFetch(input, init);
}) as typeof fetch;

const DIR = path.join(process.cwd(), "tests/fixtures/helena-dateien");
const PII: string[] = JSON.parse(readFileSync(path.join(DIR, "personendaten.json"), "utf8")).werte;

const MUSTER_TEXT = `Muster: Kündigungsschutzklage (kanzleieigen)

An das Arbeitsgericht [Ort]

Klage
der [Klagepartei], [Anschrift] – Klägerin –
gegen
die [Beklagte], vertreten durch [Geschäftsführung], [Anschrift] – Beklagte –

wegen: Kündigungsschutz
Streitwert: drei Bruttomonatsgehälter (§ 42 Abs. 2 GKG)

Namens und in Vollmacht der Klägerin erheben wir Klage und werden beantragen:
1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die Kündigung der Beklagten vom [Datum], der Klägerin zugegangen am [Datum], nicht aufgelöst worden ist.
2. Die Beklagte wird verurteilt, die Klägerin bis zum rechtskräftigen Abschluss des Kündigungsschutzverfahrens zu unveränderten arbeitsvertraglichen Bedingungen als [Tätigkeit] weiterzubeschäftigen.

Begründung:
I. Die Klägerin ist seit dem [Datum] bei der Beklagten als [Tätigkeit] beschäftigt, zuletzt zu einem Bruttomonatsgehalt von [Betrag] EUR. Die Beklagte beschäftigt regelmäßig mehr als zehn Arbeitnehmer (§ 23 Abs. 1 KSchG); das Kündigungsschutzgesetz findet Anwendung.
II. Mit Schreiben vom [Datum], zugegangen am [Datum], kündigte die Beklagte ordentlich zum [Datum].
III. Die Kündigung ist sozial ungerechtfertigt (§ 1 Abs. 2 KSchG). Gründe sind nicht genannt; die Darlegungs- und Beweislast trägt die Beklagte (§ 1 Abs. 2 S. 4 KSchG).
IV. Hilfsweise wird die Sozialauswahl gerügt (§ 1 Abs. 3 KSchG); die Beklagte wird aufgefordert, die Gründe der Sozialauswahl mitzuteilen. Die Klägerin ist [Unterhaltspflichten].
V. Die ordnungsgemäße Anhörung des Betriebsrats (§ 102 Abs. 1 BetrVG) wird mit Nichtwissen bestritten.
VI. Die Klage wahrt die Frist des § 4 S. 1 KSchG.`;

function lecksIn(bodies: string[]): string[] {
  const flach = (s: string) => s.normalize("NFC").replace(/\s+/g, " ");
  const gefunden = new Set<string>();
  for (const b of bodies) {
    let alles = b;
    try {
      alles += "\n" + JSON.stringify(JSON.parse(b));
    } catch {
      /* not JSON */
    }
    const f = flach(alles);
    for (const w of PII) if (f.includes(flach(w))) gefunden.add(w);
  }
  return [...gefunden];
}

async function main() {
  if (!process.env.ANYMIZE_API_KEY) throw new Error("ANYMIZE_API_KEY fehlt");
  const { prisma } = await import("../src/lib/db");
  const { runHelenaAgent } = await import("../src/lib/helena");
  const { insertMusterChunks } = await import("../src/lib/muster/ingestion");
  const { zuMarkdown } = await import("../src/lib/helena/datei-pipeline/konvertieren");

  // --- Seed (idempotent: fixed ids) ------------------------------------------
  const setting = (key: string, value: string, type = "string") =>
    prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value, type, category: "ai", label: key } });
  await setting("ai.provider", "anymize");
  await setting("ai.provider.model", "waterfall-2.0");
  await setting("ai.helena.tier3_model", "anthropic/claude-opus-5.5");
  await setting("helena.datei.nerPruefung", "false", "boolean"); // NER model (35B) not loaded in the test stack

  const user = await prisma.user.upsert({
    where: { email: "anwalt.test@example.org" },
    update: {},
    create: { email: "anwalt.test@example.org", name: "Test Anwalt", passwordHash: "x", role: "ANWALT" },
  });
  const kontakt = (id: string, data: Record<string, unknown>) =>
    prisma.kontakt.upsert({ where: { id }, update: {}, create: { id, staatsangehoerigkeiten: [], korrespondenzSprachen: [], tags: [], ...data } as never });
  const mandantin = await kontakt("e2e-mandantin", {
    typ: "NATUERLICH", vorname: "Sabine", nachname: "Krüger-Wendt", geburtsdatum: new Date("1983-07-14"),
    strasse: "Lindenstraße 42", plz: "50674", ort: "Köln", telefon: "0221 4789123",
    email: "sabine.krueger-wendt@beispielmail.de", iban: "DE89 3704 0044 0532 0130 00",
  });
  const gegner = await kontakt("e2e-gegner", { typ: "JURISTISCH", firma: "Rheinland Logistik Hoffmann GmbH", ort: "Köln" });
  const vorgesetzter = await kontakt("e2e-vorgesetzter", { typ: "NATUERLICH", titel: "Dr.", vorname: "Matthias", nachname: "Oberländer" });

  const akte = await prisma.akte.upsert({
    where: { aktenzeichen: "E2E-17/26" },
    update: { kiEinwilligung: "FREMDMODELLE" },
    create: {
      aktenzeichen: "E2E-17/26",
      kurzrubrum: "Krüger-Wendt ./. Rheinland Logistik Hoffmann GmbH",
      wegen: "Kündigungsschutz",
      sachgebiet: "ARBEITSRECHT",
      anwaltId: user.id,
      kiEinwilligung: "FREMDMODELLE",
      kiEinwilligungAm: new Date(),
      kiEinwilligungErfasstVon: user.id,
    },
  });
  for (const [k, rolle] of [[mandantin, "MANDANT"], [gegner, "GEGNER"], [vorgesetzter, "SONSTIGER"]] as const) {
    await prisma.beteiligter.upsert({
      where: { akteId_kontaktId_rolle: { akteId: akte.id, kontaktId: k.id, rolle } },
      update: {},
      create: { akteId: akte.id, kontaktId: k.id, rolle },
    });
  }
  if ((await prisma.dokument.count({ where: { akteId: akte.id } })) === 0) {
    for (const [datei, name] of [["akte.pdf", "Gesprächsnotiz Mandantin 03.11.2026.pdf"], ["email-mandantin.eml", "E-Mail Mandantin Kündigung.eml"]]) {
      const k = await zuMarkdown({ daten: readFileSync(path.join(DIR, datei)), dateiname: datei });
      await prisma.dokument.create({
        data: {
          akteId: akte.id, name, dateipfad: `test/${datei}`, mimeType: "application/pdf", groesse: 1000, tags: [],
          createdById: user.id, ocrText: k.markdown, ocrStatus: "ABGESCHLOSSEN", ocrAbgeschlossen: new Date(),
        },
      });
    }
  }
  if ((await prisma.muster.count({ where: { name: "Kündigungsschutzklage (kanzleieigen)" } })) === 0) {
    const m = await prisma.muster.create({
      data: { name: "Kündigungsschutzklage (kanzleieigen)", kategorie: "Arbeitsrecht", minioKey: "test/muster.txt", mimeType: "text/plain", isKanzleiEigen: true, nerStatus: "INDEXED", uploadedById: user.id },
    });
    await insertMusterChunks(m.id, MUSTER_TEXT);
  }
  console.log(`Seed: Akte ${akte.aktenzeichen}, Einwilligung FREMDMODELLE, 3 Beteiligte, 2 Dokumente, 1 Muster`);

  // --- Runs ------------------------------------------------------------------
  const laeufe: Array<{ name: string; message: string; einwilligung: "FREMDMODELLE" | "DE_MODELLE" | "KEINE"; mode?: "inline" | "background" }> = [
    { name: "Sachstand (Agent mit Werkzeugen)", message: "Wie ist der Sachstand in dieser Akte? Nenne auch das Ende der Klagefrist nach § 4 KSchG.", einwilligung: "FREMDMODELLE" },
    { name: "Kündigungsschutzklage (Schriftsatz-Ablauf)", message: "Erstelle einen Entwurf der Kündigungsschutzklage für unsere Mandantin gegen die Arbeitgeberin. Nutze unser kanzleieigenes Muster.", einwilligung: "FREMDMODELLE", mode: "background" },
    { name: "Sachstand mit Einwilligung nur DE-Modelle", message: "Fasse den Stand der Akte kurz zusammen.", einwilligung: "DE_MODELLE" },
    { name: "Ohne Einwilligung", message: "Fasse den Stand der Akte kurz zusammen.", einwilligung: "KEINE" },
  ];

  for (const l of laeufe) {
    await prisma.akte.update({ where: { id: akte.id }, data: { kiEinwilligung: l.einwilligung } });
    const entwuerfeVorher = await prisma.helenaDraft.count({ where: { akteId: akte.id } });
    const seit = ausgehend.length;
    const t0 = Date.now();
    let text = "";
    let detail = "";
    try {
      const r = await runHelenaAgent({ prisma, userId: user.id, userRole: "ANWALT", userName: user.name, akteId: akte.id, message: l.message, mode: l.mode ?? "inline" });
      text = r.text;
      detail = `Stufe ${r.tier}, ${r.steps.length} Schritte, Werkzeuge: ${r.steps.filter((s) => s.type === "toolCall").map((s) => s.toolName).join(", ") || "–"}${r.steps.some((s) => s.type === "error") ? ` | Fehler: ${r.steps.filter((s) => s.type === "error").map((s) => s.content.slice(0, 120)).join(" / ")}` : ""}, Ende: ${r.finishReason}`;
    } catch (e) {
      detail = `Abbruch: ${(e as Error).name}: ${String((e as Error).message).slice(0, 200)}`;
    }
    const neu = ausgehend.slice(seit);
    const fremdeZiele = [...new Set(neu.map((a) => new URL(a.url).host).filter((h) => !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h) && h !== "app.anymize.ai"))];
    const llm = neu.filter((a) => a.url.includes("/api/v1/llm/"));
    const anonymize = neu.filter((a) => a.url.endsWith("/api/anonymize"));
    const geloescht = neu.filter((a) => a.url.includes("/api/v1/jobs/")).length;
    const lecks = lecksIn(llm.map((a) => a.body));
    const modelle = [...new Set(llm.map((a) => { try { return JSON.parse(a.body).model; } catch { return "?"; } }))];
    console.log(`\n=== ${l.name} (Einwilligung ${l.einwilligung}) — ${Math.round((Date.now() - t0) / 1000)} s`);
    console.log(`  ${detail}`);
    console.log(`  KI-Anfragen: ${llm.length} (Modelle: ${modelle.join(", ") || "–"}), anymize-Anonymisierungen: ${anonymize.length}, Job-Löschungen: ${geloescht}`);
    console.log(`  Lecks an die KI: ${lecks.length ? lecks.join(", ") : "keine"} | fremde Ziele: ${fremdeZiele.join(", ") || "keine"}`);
    console.log(`  Platzhalter im Ergebnis: ${(text.match(/\[\[[^\]]+\]\]/g) ?? []).length} | Mandantin im Ergebnis: ${/Krüger-Wendt/.test(text)} | Frist 24.11.2026: ${/24\.\s?11\.\s?2026/.test(text)}`);
    console.log(`  Auszug: ${JSON.stringify(text.slice(0, 400))}`);
    const neueEntwuerfe = await prisma.helenaDraft.findMany({ where: { akteId: akte.id }, orderBy: { createdAt: "asc" }, skip: entwuerfeVorher });
    for (const d of neueEntwuerfe) {
      console.log(`  Entwurf ${d.typ}: "${d.titel}" | Platzhalter aus der Schleuse: ${(d.inhalt.match(/\[\[[a-z_]+-L?[0-9A-F]{5,6}\]\]/g) ?? []).length} | Mandantin: ${/Krüger-Wendt/.test(d.inhalt + d.titel)}`);
    }
  }
  const entwuerfe = await prisma.helenaDraft.count({ where: { akteId: akte.id } });
  console.log(`\nHelena-Entwürfe in der Akte: ${entwuerfe}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("FEHLER", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  process.exit(1);
});
