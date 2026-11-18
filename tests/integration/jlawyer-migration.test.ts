import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, asUser, req } from "./helpers";
import { jlawyerFixture, JL_BASE, REST, IDS } from "./jlawyer-fixtures";

const storage = vi.hoisted(() => ({ uploadFile: vi.fn(async (key: string) => key) }));
const meili = vi.hoisted(() => ({ indexDokument: vi.fn(async () => {}) }));
const queues = vi.hoisted(() => ({ ocrQueue: { add: vi.fn(async () => ({ id: "job" })) } }));
vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/meilisearch", () => meili);
vi.mock("@/lib/queue/queues", () => queues);

let admin: any, helena: any, anwalt: any, sekretariat: any, standard: any;
let fx: ReturnType<typeof jlawyerFixture>;

async function setting(key: string, value: string) {
  await prisma.systemSetting.upsert({ where: { key }, create: { key, value, category: "jlawyer" }, update: { value } });
}

async function runMigration() {
  const { POST } = await import("@/app/api/admin/jlawyer/migrate/route");
  asUser(admin);
  const res = await POST();
  return { status: res.status, body: await res.json() };
}

async function getStatus() {
  const { GET } = await import("@/app/api/admin/jlawyer/migrate/route");
  asUser(admin);
  return (await GET()).json();
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  admin = await createUser("ADMIN", { name: "Admin Start" });
  helena = await createUser("ADMIN", { isSystem: true, name: "Helena", email: "helena@system.local" });
  anwalt = await createUser("ANWALT", { email: "m.mueller@kanzlei.example", name: "Maria Müller" });
  sekretariat = await createUser("SEKRETARIAT", { name: "Sabine Sekretariat" });
  standard = await createUser("ANWALT", { name: "Stefan Standard" });
  await setting("jlawyer.url", JL_BASE);
  await setting("jlawyer.username", "migration");
  await setting("jlawyer.password", "geheim");
  await setting("jlawyer.migration.standardVerantwortlicherId", standard.id);
  fx = jlawyerFixture();
  vi.stubGlobal("fetch", fx.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("j-lawyer-Migration: echte REST-Pfade und Feldzuordnung (Fehler 1)", () => {
  it("ruft nur Katalog-Pfade unter dem REST-Root auf und übernimmt die Daten", async () => {
    const { status, body } = await runMigration();
    expect(status).toBe(200);
    expect(body.report.errors).toEqual([]);

    const paths = new Set(fx.calls.map((p) => p.slice(REST.length)));
    for (const p of [
      "/v1/cases/list",
      `/v2/cases/${IDS.C1}`,
      `/v1/cases/${IDS.C1}/parties`,
      `/v4/cases/${IDS.C1}/duedates`,
      `/v1/cases/${IDS.C1}/documents`,
      `/v3/cases/${IDS.C1}/folders`,
      "/v1/cases/document/doc1/content",
      "/v1/contacts/list",
      `/v2/contacts/${IDS.K1}`,
      "/v6/security/users/list",
    ]) expect(paths).toContain(p);
    expect(fx.calls.every((p) => p.startsWith(`${REST}/v`))).toBe(true);

    const a1 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C1 } });
    expect(a1).toMatchObject({
      aktenzeichen: "00012/26", kurzrubrum: "Neu ./. Acme GmbH", wegen: "Kündigung",
      sachgebiet: "ARBEITSRECHT", status: "OFFEN", notizen: "Notiz aus j-lawyer",
    });
    expect(a1.angelegt.toISOString()).toBe("2026-01-15T09:30:00.000Z");
    expect(Number(a1.gegenstandswert)).toBe(12000);
    const a2 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C2 } });
    expect(a2.status).toBe("ARCHIVIERT");
    expect(a2.angelegt.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    const k1 = await prisma.kontakt.findUniqueOrThrow({ where: { jlawyerId: IDS.K1 } });
    expect(k1).toMatchObject({ typ: "NATUERLICH", vorname: "Eva", nachname: "Neu", strasse: "Ring 5", email: "eva@example.com", land: "Deutschland" });
    expect(k1.geburtsdatum?.toISOString()).toBe("1980-02-01T00:00:00.000Z");
    const k2 = await prisma.kontakt.findUniqueOrThrow({ where: { jlawyerId: IDS.K2 } });
    expect(k2).toMatchObject({ typ: "JURISTISCH", firma: "Acme GmbH", rechtsform: "GmbH" });

    const bet = await prisma.beteiligter.findMany({ where: { akteId: a1.id }, orderBy: { rolle: "asc" } });
    expect(bet.map((b) => [b.kontaktId, b.rolle])).toEqual([
      [k1.id, "MANDANT"],
      [k2.id, "GEGNER"],
    ]);
    expect(bet[1].notizen).toContain("AZ-G-7");

    const frist = await prisma.kalenderEintrag.findFirstOrThrow({ where: { jlawyerId: "d1" } });
    expect(frist).toMatchObject({ typ: "FRIST", titel: "Klagefrist § 4 KSchG", beschreibung: "3 Wochen", erledigt: false, akteId: a1.id });
    expect(frist.datum.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    const termin = await prisma.kalenderEintrag.findFirstOrThrow({ where: { jlawyerId: "d3" } });
    expect(termin).toMatchObject({ typ: "TERMIN", ganztaegig: false, erledigt: true });
    expect(termin.datumBis?.toISOString()).toBe("2026-12-03T14:00:00.000Z");
  });

  it("Verbindungstest nutzt einen Katalog-Endpunkt", async () => {
    const { POST } = await import("@/app/api/admin/jlawyer/test/route");
    asUser(admin);
    const res = await POST(req("/api/admin/jlawyer/test", { method: "POST", json: {} }));
    expect(await res.json()).toEqual({ ok: true });
    expect(fx.calls).toEqual([`${REST}/v1/cases/party/types`]);
  });
});

describe("j-lawyer-Migration: Verantwortliche (Fehler 2)", () => {
  it("ordnet Anwalt, Sachbearbeiter und Fristverantwortliche per Benutzerabgleich zu, Fallback mit Hinweis", async () => {
    const { body } = await runMigration();

    const a1 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C1 } });
    expect(a1.anwaltId).toBe(anwalt.id); // über E-Mail aus der j-lawyer-Benutzerliste
    expect(a1.sachbearbeiterId).toBe(sekretariat.id); // über Anzeigename
    const a2 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C2 } });
    expect(a2.anwaltId).toBe(standard.id); // "ghost" unbekannt → Standard

    const byId = async (id: string) => (await prisma.kalenderEintrag.findFirstOrThrow({ where: { jlawyerId: id } })).verantwortlichId;
    expect(await byId("d1")).toBe(anwalt.id);
    expect(await byId("d2")).toBe(anwalt.id); // unbekannter Bearbeiter → Anwalt der Akte
    expect(await byId("d3")).toBe(standard.id); // Akte mit Standard-Anwalt
    expect(await prisma.kalenderEintrag.count({ where: { verantwortlichId: helena.id } })).toBe(0);

    const hinweise = body.report.hinweise.map((h: any) => `${h.entity}|${h.id}|${h.message}`).join("\n");
    expect(hinweise).toMatch(/Akte\|00013\/26\|Anwalt "ghost".*Stefan Standard/);
    expect(hinweise).toMatch(/Kalender\|d2\|Verantwortlicher "ghost".*Anwalt der Akte/);
    expect(hinweise).not.toMatch(/\|00012\/26\|/);

    // Sichtbarkeit: der zugeordnete Anwalt sieht seine Akte
    const { buildAkteAccessFilter } = await import("@/lib/rbac");
    const sichtbar = await prisma.akte.findMany({ where: await buildAkteAccessFilter(anwalt.id, "ANWALT") as any });
    expect(sichtbar.map((a) => a.id)).toContain(a1.id);
  });

  it("ohne konfigurierten Standard ist der startende Administrator Fallback, nie Helena", async () => {
    await prisma.systemSetting.delete({ where: { key: "jlawyer.migration.standardVerantwortlicherId" } });
    await runMigration();
    const a2 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C2 } });
    expect(a2.anwaltId).toBe(admin.id);
  });

  it("Standard-Verantwortlicher ist über die Konfigurations-API setzbar und wird validiert", async () => {
    const { POST, GET } = await import("@/app/api/admin/jlawyer/route");
    asUser(admin);
    expect((await POST(req("/x", { method: "POST", json: { standardVerantwortlicherId: helena.id } }))).status).toBe(400);
    expect((await POST(req("/x", { method: "POST", json: { standardVerantwortlicherId: anwalt.id } }))).status).toBe(200);
    const cfg = await (await GET()).json();
    expect(cfg.standardVerantwortlicherId).toBe(anwalt.id);
    expect(cfg.benutzer.map((b: any) => b.id)).not.toContain(helena.id);
  });
});

describe("j-lawyer-Migration: erneuter Lauf überschreibt nichts (Fehler 3)", () => {
  it("lässt in AI-Lawyer geänderte Akten, Fristen und Kontakte unverändert", async () => {
    await runMigration();
    const a1 = await prisma.akte.findUniqueOrThrow({ where: { jlawyerId: IDS.C1 } });
    await prisma.akte.update({ where: { id: a1.id }, data: { kurzrubrum: "Bearbeitet", status: "RUHEND", anwaltId: standard.id } });
    await prisma.kalenderEintrag.updateMany({ where: { jlawyerId: "d1" }, data: { erledigt: true, erledigungsgrund: "Klage eingereicht" } });
    await prisma.kontakt.update({ where: { jlawyerId: IDS.K1 }, data: { telefon: "0170 neu" } });

    const { body } = await runMigration();
    expect(body.report).toMatchObject({ akten: 0, kontakte: 0, beteiligte: 0, dokumente: 0, kalender: 0, errors: [] });

    expect(await prisma.akte.findUniqueOrThrow({ where: { id: a1.id } })).toMatchObject({ kurzrubrum: "Bearbeitet", status: "RUHEND", anwaltId: standard.id });
    expect(await prisma.kalenderEintrag.findFirstOrThrow({ where: { jlawyerId: "d1" } })).toMatchObject({ erledigt: true, erledigungsgrund: "Klage eingereicht" });
    expect((await prisma.kontakt.findUniqueOrThrow({ where: { jlawyerId: IDS.K1 } })).telefon).toBe("0170 neu");
    expect(await prisma.akte.count()).toBe(2);
    expect(await prisma.kalenderEintrag.count()).toBe(3);
    expect(await prisma.dokument.count()).toBe(2);
    expect(await prisma.beteiligter.count()).toBe(2);
  });

  it("überschreibt einen bestehenden Kontakt mit gleicher E-Mail nicht", async () => {
    const bestand = await prisma.kontakt.create({
      data: { typ: "NATUERLICH", vorname: "Eva", nachname: "Neu", email: "EVA@example.com", telefon: "0123 alt", notizen: "gepflegt" },
    });
    const fremd = await prisma.kontakt.create({ data: { typ: "JURISTISCH", firma: "Andere AG", email: "info@acme.example" } });

    const { body } = await runMigration();

    const k = await prisma.kontakt.findUniqueOrThrow({ where: { id: bestand.id } });
    expect(k).toMatchObject({ telefon: "0123 alt", notizen: "gepflegt", jlawyerId: IDS.K1 }); // nur verknüpft
    const f = await prisma.kontakt.findUniqueOrThrow({ where: { id: fremd.id } });
    expect(f).toMatchObject({ firma: "Andere AG", jlawyerId: null }); // anderer Name → nicht übernommen
    const neu = await prisma.kontakt.findUniqueOrThrow({ where: { jlawyerId: IDS.K2 } });
    expect(neu.id).not.toBe(fremd.id);
    const msgs = body.report.hinweise.map((h: any) => h.message).join("\n");
    expect(msgs).toContain(`verknüpft`);
    expect(msgs).toContain(`mögliche Dublette von Kontakt ${fremd.id}`);
  });
});

describe("j-lawyer-Migration: Laufstatus (Fehler 4)", () => {
  it("ein durch Neustart verwaister Lauf blockiert nicht und wird als unterbrochen gemeldet", async () => {
    await setting("jlawyer.migration.status", "running");
    await prisma.$executeRawUnsafe(`UPDATE system_settings SET "updatedAt" = now() - interval '10 minutes' WHERE key = 'jlawyer.migration.status'`);

    const st = await getStatus();
    expect(st.status).toBe("error");
    expect(st.abbruch).toMatch(/unterbrochen/);

    const { status, body } = await runMigration();
    expect(status).toBe(200);
    expect(body.report.hinweise[0].message).toMatch(/unterbrochen/);
    expect((await getStatus()).status).toBe("done");
  });

  it("ein laufender (lebender) Lauf blockiert weiterhin", async () => {
    await setting("jlawyer.migration.status", "running");
    const { status } = await runMigration();
    expect(status).toBe(409);
    expect(fx.calls).toEqual([]);
  });

  it("parallele Starts: genau einer läuft", async () => {
    const results = await Promise.all([runMigration(), runMigration()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("nach fehlgeschlagenem Lauf liefert GET einen vollständigen Bericht mit errors-Liste", async () => {
    fx.failWith("/v1/cases/list", 401);
    const { status, body } = await runMigration();
    expect(status).toBe(500);
    expect(body.error).toContain("401");

    const st = await getStatus();
    expect(st.status).toBe("error");
    expect(Array.isArray(st.report.errors)).toBe(true);
    expect(st.report.errors[0]).toMatchObject({ entity: "Migration" });
    expect(Array.isArray(st.report.hinweise)).toBe(true);
    expect(st.abbruch).toContain("401");
  });

  it("normalisiert alte gespeicherte Fehlerberichte ({error}) für die Oberfläche", async () => {
    await setting("jlawyer.migration.status", "error");
    await setting("jlawyer.migration.report", JSON.stringify({ error: "boom" }));
    const st = await getStatus();
    expect(st.report).toMatchObject({ akten: 0, errors: [{ entity: "Migration", id: "-", message: "boom" }], hinweise: [] });
    expect(st.abbruch).toBe("boom");
  });
});

describe("j-lawyer-Migration: Dokumente durchlaufen die Upload-Pipeline (Fehler 5)", () => {
  it("speichert, indexiert und reiht OCR ein wie ein normaler Upload", async () => {
    await runMigration();
    const pdf = await prisma.dokument.findFirstOrThrow({ where: { jlawyerId: "doc1" } });
    expect(pdf).toMatchObject({ name: "Kündigung.pdf", mimeType: "application/pdf", ordner: "Schriftsätze", ocrStatus: "AUSSTEHEND", groesse: 10, createdById: admin.id });
    expect(storage.uploadFile).toHaveBeenCalledWith(pdf.dateipfad, expect.any(Buffer), "application/pdf", 10);
    expect(queues.ocrQueue.add).toHaveBeenCalledWith("ocr-document", expect.objectContaining({ dokumentId: pdf.id, storagePath: pdf.dateipfad, mimeType: "application/pdf" }));

    const txt = await prisma.dokument.findFirstOrThrow({ where: { jlawyerId: "doc2" } });
    expect(txt).toMatchObject({ ocrStatus: "NICHT_NOETIG", ocrText: "Hallo", version: 2 });
    expect(queues.ocrQueue.add).toHaveBeenCalledTimes(1);

    expect(meili.indexDokument).toHaveBeenCalledTimes(2);
    expect(meili.indexDokument).toHaveBeenCalledWith(expect.objectContaining({ id: pdf.id, aktenzeichen: "00012/26", createdByName: "Admin Start" }));
  });

  it("wenn die OCR-Warteschlange nicht erreichbar ist, wird das Dokument für den Wiederanlauf markiert", async () => {
    queues.ocrQueue.add.mockRejectedValueOnce(new Error("redis down"));
    const { body } = await runMigration();
    const pdf = await prisma.dokument.findFirstOrThrow({ where: { jlawyerId: "doc1" } });
    expect(pdf.ocrStatus).toBe("FEHLGESCHLAGEN");
    expect(body.report.hinweise.some((h: any) => h.id === "doc1" && /OCR/.test(h.message))).toBe(true);
  });
});
