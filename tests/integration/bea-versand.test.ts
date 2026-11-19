import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from "./helpers";

const { dateien, provider, sitzungAufrufe } = vi.hoisted(() => ({
  dateien: new Map<string, Buffer>(),
  provider: {
    sende: vi.fn(async () => ({ messageId: "bea-1" })),
    speichereEntwurf: vi.fn(async () => ({ messageId: "bea-entwurf-1" })),
    gibEebAb: vi.fn(async () => ({ messageId: "bea-eeb-1" })),
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
    const fremdAkte = await createAkte({ anwaltId: fremd.id });
    asUser(fremd);
    const res = await postMessage(versand({ akteId: fremdAkte.id }));
    expect(res.status).toBe(404);
    expect(provider.sende).not.toHaveBeenCalled();
  });

  it("Anhang aus einer anderen (zugänglichen) Akte oder ohne Akte → 400, Provider nicht aufgerufen", async () => {
    const akte2 = await createAkte({ anwaltId: anwalt.id });
    asUser(anwalt);
    const r1 = await postMessage(versand({ akteId: akte2.id }));
    expect(r1.status).toBe(400);
    expect((await r1.json()).error).toBe("Dokument gehört nicht zur Akte");
    const r2 = await postMessage(versand({ akteId: undefined }));
    expect(r2.status).toBe(400);
    expect((await r2.json()).error).toBe("Für Anhänge muss eine Akte angegeben werden");
    const pruef = (await import("@/app/api/bea/messages/versand-pruefung/route")).POST;
    const r3 = await pruef(req("/x", { method: "POST", json: versand({ akteId: akte2.id }) }));
    expect(r3.status).toBe(400);
    expect(provider.sende).not.toHaveBeenCalled();
    expect(await prisma.beaNachricht.count()).toBe(0);
  });

  it("GET listet nur Nachrichten ohne Akte oder mit zugänglicher Akte", async () => {
    const fremd = await createUser("ANWALT");
    const fremdAkte = await createAkte({ anwaltId: fremd.id });
    await prisma.beaNachricht.createMany({
      data: [
        { betreff: "eigene", absender: "a", empfaenger: "e", akteId: akte.id },
        { betreff: "fremde", absender: "a", empfaenger: "e", akteId: fremdAkte.id },
        { betreff: "offen", absender: "a", empfaenger: "e" },
      ],
    });
    const { GET } = await import("@/app/api/bea/messages/route");
    const liste = async () => {
      const j = await (await GET(req("/api/bea/messages"))).json();
      return { betreffs: j.nachrichten.map((n: any) => n.betreff).sort(), total: j.total };
    };
    asUser(anwalt);
    expect(await liste()).toEqual({ betreffs: ["eigene", "offen"], total: 2 });
    asUser(fremd);
    expect(await liste()).toEqual({ betreffs: ["fremde", "offen"], total: 2 });
    const admin = await createUser("ADMIN");
    asUser(admin);
    expect((await liste()).total).toBe(3);
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

describe("eEB abgeben", () => {
  let eingang: any;
  beforeEach(async () => {
    provider.gibEebAb.mockClear();
    eingang = await prisma.beaNachricht.create({
      data: {
        nachrichtenId: "bea-in-1", xjustizNachrichtenId: "xj-1", betreff: "Urteil", absender: "AG", empfaenger: "RA",
        richtung: "EINGANG", eebAngefordert: true, eebStatus: "AUSSTEHEND",
        postfachSafeId: "DE.BRAK.1", safeIdAbsender: "DE.J.2", akteId: akte.id,
      },
    });
  });
  const eeb = async (id: string, body?: unknown) =>
    (await import("@/app/api/bea/messages/[id]/eeb/route")).POST(
      req(`/x`, { method: "POST", ...(body !== undefined ? { json: body } : {}) }),
      params({ id })
    );
  const heute = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

  it("ohne Abgabedatum → 400, Provider nicht aufgerufen, Status bleibt AUSSTEHEND", async () => {
    asUser(anwalt);
    expect((await eeb(eingang.id)).status).toBe(400);
    expect(provider.gibEebAb).not.toHaveBeenCalled();
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: eingang.id } })).eebStatus).toBe("AUSSTEHEND");
  });

  it("Nachricht ohne xjustizNachrichtenId → 422", async () => {
    const ohne = await prisma.beaNachricht.create({
      data: { betreff: "x", absender: "a", empfaenger: "e", eebAngefordert: true, eebStatus: "AUSSTEHEND", postfachSafeId: "p", safeIdAbsender: "s" },
    });
    asUser(anwalt);
    expect((await eeb(ohne.id, { abgabeDatum: heute() })).status).toBe(422);
  });

  it("gibt serverseitig ab → BESTAETIGT, Akten-Aktenzeichen im eEB, wiederholen: false", async () => {
    asUser(anwalt);
    const res = await eeb(eingang.id, { abgabeDatum: heute() });
    expect(res.status).toBe(200);
    expect(provider.gibEebAb).toHaveBeenCalledTimes(1);
    expect((provider.gibEebAb.mock.calls[0] as any[])[1]).toMatchObject({ fremdId: "xj-1", empfaengerSafeId: "DE.J.2", aktenzeichenAbsender: "00042/26" });
    expect(sitzungAufrufe.at(-1)).toEqual({ wiederholen: false });
    const n = await prisma.beaNachricht.findUniqueOrThrow({ where: { id: eingang.id } });
    expect(n.eebStatus).toBe("BESTAETIGT");
    expect(n.eebDatum).not.toBeNull();
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
