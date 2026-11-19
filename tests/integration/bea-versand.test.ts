import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from "./helpers";
import { buildEebBestaetigung } from "@/lib/bea/versand";

const { dateien, provider, sitzungAufrufe } = vi.hoisted(() => ({
  dateien: new Map<string, Buffer>(),
  provider: {
    sende: vi.fn(async () => ({ messageId: "bea-1" })),
    speichereEntwurf: vi.fn(async () => ({ messageId: "bea-entwurf-1" })),
  },
  sitzungAufrufe: [] as { wiederholen: boolean }[],
}));

vi.mock("@/lib/queue/queues", () => ({ aiScanQueue: { add: vi.fn() } }));
vi.mock("@/lib/storage", () => ({
  getFileStream: vi.fn(async (key: string) => {
    const b = dateien.get(key);
    return b ? { transformToByteArray: async () => new Uint8Array(b) } : undefined;
  }),
}));
vi.mock("@/lib/bea/provider", () => ({ getBeaProvider: () => provider }));
// Session layer (Redis, certificate, login) is covered by unit tests; here the
// provider is invoked directly so the route runs against the real database.
vi.mock("@/lib/bea/sitzung", async (orig) => ({
  ...(await orig<typeof import("@/lib/bea/sitzung")>()),
  mitBeaSitzung: vi.fn(async (_userId: string, fn: (s: unknown, p: unknown) => Promise<unknown>, opts: { wiederholen: boolean }) => {
    sitzungAufrufe.push(opts);
    return fn({ token: "t", sessionKey: Buffer.alloc(0), safeId: "DE.BRAK.1" }, provider);
  }),
}));

let anwalt: any, akte: any, freigegeben: any, entwurf: any;

beforeEach(async () => {
  await resetDb();
  dateien.clear();
  sitzungAufrufe.length = 0;
  provider.sende.mockClear();
  provider.speichereEntwurf.mockClear();
  anwalt = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id, aktenzeichen: "00042/26" });
  freigegeben = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Klage.pdf", dateipfad: "a/k.pdf", mimeType: "application/pdf", groesse: 4, createdById: anwalt.id, status: "FREIGEGEBEN", freigegebenDurchId: anwalt.id },
  });
  entwurf = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Entwurf.pdf", dateipfad: "a/e.pdf", mimeType: "application/pdf", groesse: 4, createdById: anwalt.id, status: "ENTWURF" },
  });
  dateien.set("a/k.pdf", Buffer.from("%PDF"));
  dateien.set("a/e.pdf", Buffer.from("%PDF"));
});

const versand = (extra: Record<string, unknown> = {}) => ({
  akteId: akte.id,
  postfachSafeId: "DE.BRAK.1",
  empfaengerSafeIds: ["DE.J.2"],
  betreff: "Klage Müller ß €",
  text: "",
  aktenzeichenAbsender: "00042/26",
  nachrichtenTyp: "ALLGEMEINE_NACHRICHT",
  eebAnfordern: false,
  dringend: false,
  anhaenge: [{ dokumentId: freigegeben.id, art: "SCHRIFTSATZ" }],
  alsEntwurf: false,
  ...extra,
});
const postMessage = async (body: unknown) =>
  (await import("@/app/api/bea/messages/route")).POST(req("/api/bea/messages", { method: "POST", json: body }));

describe("beA-Versand (serverseitig)", () => {
  it("lehnt den alten Browser-Vertrag ab (kein Versand, kein Datensatz)", async () => {
    asUser(anwalt);
    const res = await postMessage({ betreff: "x", absender: "a", empfaenger: "e", status: "GESENDET", nachrichtenId: "x", dokumentIds: [freigegeben.id] });
    expect(res.status).toBe(400);
    expect(provider.sende).not.toHaveBeenCalled();
    expect(await prisma.beaNachricht.count()).toBe(0);
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("FREIGEGEBEN");
  });

  it("sendet einmal ohne Wiederholung, speichert AUSGANG/GESENDET mit Akte und setzt Dokument auf VERSENDET", async () => {
    asUser(anwalt);
    const res = await postMessage(versand());
    expect(res.status).toBe(201);
    expect(provider.sende).toHaveBeenCalledTimes(1);
    expect(sitzungAufrufe).toEqual([{ wiederholen: false }]);
    const n = await prisma.beaNachricht.findFirstOrThrow();
    expect(n).toMatchObject({
      status: "GESENDET", richtung: "AUSGANG", nachrichtenId: "bea-1", akteId: akte.id,
      betreff: "Klage Müller ß €", postfachSafeId: "DE.BRAK.1", aktenzeichenAbsender: "00042/26",
    });
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("VERSENDET");
    const audit = await prisma.auditLog.findFirst({ where: { aktion: "BEA_NACHRICHT_GESENDET" } });
    expect(audit).not.toBeNull();
  });

  it("Provider-Fehler → 502, FEHLER mit Hinweis, Dokument bleibt FREIGEGEBEN", async () => {
    provider.sende.mockRejectedValueOnce(new Error("Zeitüberschreitung"));
    asUser(anwalt);
    const res = await postMessage(versand());
    expect(res.status).toBe(502);
    expect(provider.sende).toHaveBeenCalledTimes(1);
    const n = await prisma.beaNachricht.findFirstOrThrow();
    expect(n.status).toBe("FEHLER");
    expect(n.inhalt).toContain("Versandstatus unklar – bitte im beA-Webclient prüfen");
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("FREIGEGEBEN");
  });

  it("nicht freigegebenes Dokument → 400, Provider nicht aufgerufen", async () => {
    asUser(anwalt);
    const res = await postMessage(versand({ anhaenge: [{ dokumentId: entwurf.id, art: "ATTACHMENT" }] }));
    expect(res.status).toBe(400);
    expect(provider.sende).not.toHaveBeenCalled();
    expect(await prisma.beaNachricht.count()).toBe(0);
  });

  it("Dokument einer fremden Akte → 404, Provider nicht aufgerufen", async () => {
    const fremd = await createUser("ANWALT");
    asUser(fremd);
    const res = await postMessage(versand({ akteId: undefined }));
    expect(res.status).toBe(404);
    expect(provider.sende).not.toHaveBeenCalled();
  });

  it("SACHBEARBEITER ohne canSendBeA → 403", async () => {
    const sb = await createUser("SACHBEARBEITER");
    asUser(sb);
    expect((await postMessage(versand())).status).toBe(403);
    expect(provider.sende).not.toHaveBeenCalled();
  });

  it("Vorabprüfung blockiert nicht freigegebene Dokumente und meldet Regelverstöße", async () => {
    asUser(anwalt);
    const pruef = (await import("@/app/api/bea/messages/versand-pruefung/route")).POST;
    const rot = await pruef(req("/x", { method: "POST", json: versand({ anhaenge: [{ dokumentId: entwurf.id, art: "ATTACHMENT" }] }) }));
    expect(rot.status).toBe(400);
    expect((await rot.json()).ok).toBe(false);
    const gruen = await pruef(req("/x", { method: "POST", json: versand() }));
    expect(await gruen.json()).toEqual({ ok: true, fehler: [], warnungen: [], verstoesse: [], errors: [] });
    const zeichen = await (await pruef(req("/x", { method: "POST", json: versand({ betreff: "„Klage“" }) }))).json();
    expect(zeichen.ok).toBe(false);
    expect(zeichen.verstoesse).toHaveLength(2);
    expect(provider.sende).not.toHaveBeenCalled();
  });
});

describe("eEB speichern", () => {
  let eingang: any;
  beforeEach(async () => {
    eingang = await prisma.beaNachricht.create({
      data: { nachrichtenId: "bea-in-1", betreff: "Urteil", absender: "AG", empfaenger: "RA", eebStatus: "AUSSTEHEND" },
    });
  });
  const eeb = async (id: string, body?: unknown) =>
    (await import("@/app/api/bea/messages/[id]/eeb/route")).POST(
      req(`/x`, { method: "POST", ...(body !== undefined ? { json: body } : {}) }),
      params({ id })
    );

  it("ohne bea.expert-Bestätigung → 400, Status bleibt AUSSTEHEND", async () => {
    asUser(anwalt);
    expect((await eeb(eingang.id)).status).toBe(400);
    expect((await eeb(eingang.id, { nachrichtenId: "andere", eebDatum: new Date().toISOString() })).status).toBe(400);
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: eingang.id } })).eebStatus).toBe("AUSSTEHEND");
  });

  it("Nachricht ohne beA-ID → 409", async () => {
    const ohne = await prisma.beaNachricht.create({ data: { betreff: "x", absender: "a", empfaenger: "e", eebStatus: "AUSSTEHEND" } });
    asUser(anwalt);
    expect((await eeb(ohne.id, { nachrichtenId: "x", eebDatum: new Date().toISOString() })).status).toBe(409);
  });

  it("mit Bestätigung → BESTAETIGT mit dem abgegebenen Datum", async () => {
    asUser(anwalt);
    const d = new Date("2026-11-18T09:30:00Z");
    const res = await eeb(eingang.id, buildEebBestaetigung({ ok: true, data: { success: true } }, "bea-in-1", d));
    expect(res.status).toBe(200);
    const n = await prisma.beaNachricht.findUniqueOrThrow({ where: { id: eingang.id } });
    expect(n.eebStatus).toBe("BESTAETIGT");
    expect(n.eebDatum?.toISOString()).toBe(d.toISOString());
  });

  it("PATCH kann GESENDET / BESTAETIGT nicht direkt setzen", async () => {
    asUser(anwalt);
    const patch = (await import("@/app/api/bea/messages/[id]/route")).PATCH;
    expect((await patch(req("/x", { method: "PATCH", json: { eebStatus: "BESTAETIGT" } }), params({ id: eingang.id }))).status).toBe(400);
    expect((await patch(req("/x", { method: "PATCH", json: { status: "GESENDET" } }), params({ id: eingang.id }))).status).toBe(400);
  });
});

describe("Auto-Zuordnung", () => {
  // Incoming messages are created by the server-side retrieval (Task 9), not via POST.
  it("WAHRSCHEINLICH (SAFE-ID) wird nur vorgeschlagen, SICHER (Aktenzeichen) zugeordnet", async () => {
    const kontakt = await createKontakt({ beaSafeId: "DE.BRAK.GEGNER" });
    const akte2 = await createAkte({ anwaltId: anwalt.id });
    await prisma.beteiligter.createMany({
      data: [{ akteId: akte.id, kontaktId: kontakt.id, rolle: "GEGNER" }, { akteId: akte2.id, kontaktId: kontakt.id, rolle: "GEGNER" }] as any,
    });
    asUser(anwalt);
    const auto = (await import("@/app/api/bea/auto-assign/route")).POST;

    const vermutet = await prisma.beaNachricht.create({
      data: { betreff: "Schriftsatz", absender: "RA Gegner", empfaenger: "RA", safeIdAbsender: "DE.BRAK.GEGNER" },
    });
    const r1 = await (await auto(req("/x", { method: "POST", json: { nachrichtId: vermutet.id } }))).json();
    expect(r1.zugeordnet).toBe(false);
    expect(r1.confidence).toBe("WAHRSCHEINLICH");
    expect(r1.akteId).not.toBeNull();
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: vermutet.id } })).akteId).toBeNull();

    const sicher = await prisma.beaNachricht.create({
      data: { betreff: "Ihr Zeichen 00042/26", absender: "AG", empfaenger: "RA" },
    });
    const r2 = await (await auto(req("/x", { method: "POST", json: { nachrichtId: sicher.id } }))).json();
    expect(r2.zugeordnet).toBe(true);
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: sicher.id } })).akteId).toBe(akte.id);
  });
});
