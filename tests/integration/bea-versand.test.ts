import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, createKontakt, asUser, req, params } from "./helpers";
import { buildGesendetNachricht, buildEebBestaetigung } from "@/lib/bea/versand";

vi.mock("@/lib/queue/queues", () => ({ aiScanQueue: { add: vi.fn() } }));

let anwalt: any, akte: any, freigegeben: any, entwurf: any;

beforeEach(async () => {
  await resetDb();
  anwalt = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id, aktenzeichen: "00042/26" });
  freigegeben = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Klage.pdf", dateipfad: "a/k.pdf", mimeType: "application/pdf", groesse: 1, createdById: anwalt.id, status: "FREIGEGEBEN", freigegebenDurchId: anwalt.id },
  });
  entwurf = await prisma.dokument.create({
    data: { akteId: akte.id, name: "Entwurf.pdf", dateipfad: "a/e.pdf", mimeType: "application/pdf", groesse: 1, createdById: anwalt.id, status: "ENTWURF" },
  });
});

const form = () => ({
  betreff: "Klage", inhalt: "", absender: "RA", safeIdAbsender: "DE.BRAK.1",
  empfaenger: "AG", safeIdEmpfaenger: "DE.J.2", dokumentIds: [freigegeben.id],
  anhaenge: [{ name: "Klage.pdf", mimeType: "application/pdf", dokumentId: freigegeben.id }], akteId: akte.id,
});
const postMessage = async (body: unknown) =>
  (await import("@/app/api/bea/messages/route")).POST(req("/api/bea/messages", { method: "POST", json: body }));

describe("beA-Versand speichern", () => {
  it("lehnt GESENDET ohne beA-Nachrichten-ID ab (fehlgeschlagener Versand)", async () => {
    asUser(anwalt);
    const res = await postMessage({ betreff: "x", absender: "a", empfaenger: "e", status: "GESENDET", dokumentIds: [freigegeben.id] });
    expect(res.status).toBe(400);
    expect(await prisma.beaNachricht.count()).toBe(0);
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("FREIGEGEBEN");
  });

  it("speichert bestätigten Versand mit Akte und setzt Dokument auf VERSENDET", async () => {
    asUser(anwalt);
    const rec = buildGesendetNachricht({ ok: true, data: { nachrichtenId: "bea-1" } }, form());
    const res = await postMessage(rec);
    expect(res.status).toBe(201);
    const n = await prisma.beaNachricht.findFirstOrThrow();
    expect(n).toMatchObject({ status: "GESENDET", nachrichtenId: "bea-1", akteId: akte.id });
    expect((await prisma.dokument.findUniqueOrThrow({ where: { id: freigegeben.id } })).status).toBe("VERSENDET");
  });

  it("Vorabprüfung blockiert nicht freigegebene Dokumente vor dem Versand", async () => {
    asUser(anwalt);
    const pruef = (await import("@/app/api/bea/messages/versand-pruefung/route")).POST;
    const rot = await pruef(req("/x", { method: "POST", json: { dokumentIds: [entwurf.id] } }));
    expect(rot.status).toBe(400);
    expect((await rot.json()).ok).toBe(false);
    const gruen = await pruef(req("/x", { method: "POST", json: { dokumentIds: [freigegeben.id] } }));
    expect(await gruen.json()).toEqual({ ok: true, errors: [] });
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
  it("WAHRSCHEINLICH (SAFE-ID) wird nur vorgeschlagen, SICHER (Aktenzeichen) zugeordnet", async () => {
    const kontakt = await createKontakt({ beaSafeId: "DE.BRAK.GEGNER" });
    const akte2 = await createAkte({ anwaltId: anwalt.id });
    await prisma.beteiligter.createMany({
      data: [{ akteId: akte.id, kontaktId: kontakt.id, rolle: "GEGNER" }, { akteId: akte2.id, kontaktId: kontakt.id, rolle: "GEGNER" }] as any,
    });
    asUser(anwalt);
    const res = await postMessage({ betreff: "Schriftsatz", absender: "RA Gegner", empfaenger: "RA", safeIdAbsender: "DE.BRAK.GEGNER" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.nachricht.akteId).toBeNull();
    expect(body.assignment.confidence).toBe("WAHRSCHEINLICH");
    expect(body.assignment.vorschlagAkteId).not.toBeNull();

    const auto = (await import("@/app/api/bea/auto-assign/route")).POST;
    const r1 = await (await auto(req("/x", { method: "POST", json: { nachrichtId: body.nachricht.id } }))).json();
    expect(r1.zugeordnet).toBe(false);
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: body.nachricht.id } })).akteId).toBeNull();

    const sicher = await postMessage({ betreff: "Ihr Zeichen 00042/26", absender: "AG", empfaenger: "RA" });
    expect((await sicher.json()).nachricht.akteId).toBe(akte.id);
  });
});
