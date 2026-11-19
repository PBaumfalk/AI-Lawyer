import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";

const { dateien, queueAdd, kaputt } = vi.hoisted(() => ({
  dateien: new Map<string, Buffer>(),
  queueAdd: vi.fn(async () => ({})),
  kaputt: { aktiv: false },
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(async (key: string, body: Buffer) => (dateien.set(key, Buffer.from(body)), key)),
  getFileStream: vi.fn(async (key: string) => {
    if (kaputt.aktiv) throw new Error("MinIO nicht erreichbar");
    const b = dateien.get(key);
    if (!b) return undefined;
    return {
      transformToByteArray: async () => new Uint8Array(b),
      transformToWebStream: () => new Blob([new Uint8Array(b)]).stream(),
    };
  }),
  generateStorageKey: (akteId: string, name: string) => `akten/${akteId}/dokumente/${name}`,
}));
vi.mock("@/lib/queue/queues", () => ({ ocrQueue: { add: queueAdd }, beaSyncQueue: { add: queueAdd } }));
vi.mock("@/lib/bea/provider", () => ({ getBeaProvider: () => ({}) }));

const route = () => import("@/app/api/bea/messages/[id]/route");

let anwalt: any, fremd: any, akte: any, akte2: any;

async function nachricht(extra: Record<string, unknown> = {}) {
  dateien.set("bea/DE.K/m1/1.pdf", Buffer.from("%PDF"));
  return prisma.beaNachricht.create({
    data: {
      nachrichtenId: `m-${Math.random()}`, betreff: "Ladung", absender: "LG", empfaenger: "RA",
      anhaenge: [{ id: "1.pdf", name: "1.pdf", storageKey: "bea/DE.K/m1/1.pdf", mimeType: "application/pdf", groesse: 4, art: null }],
      ...extra,
    } as any,
  });
}

beforeEach(async () => {
  await resetDb();
  dateien.clear();
  kaputt.aktiv = false;
  queueAdd.mockClear();
  anwalt = await createUser("ANWALT");
  fremd = await createUser("ANWALT");
  akte = await createAkte({ anwaltId: anwalt.id });
  akte2 = await createAkte({ anwaltId: anwalt.id });
});

describe("Zuordnung eingegangener beA-Nachrichten", () => {
  it("Zuordnung legt die Anhänge als Dokumente an; Umzuordnung danach → 409 ohne Änderung", async () => {
    const n = await nachricht();
    asUser(anwalt);
    const { PATCH } = await route();
    const r1 = await PATCH(req("/x", { method: "PATCH", json: { akteId: akte.id } }), params({ id: n.id }));
    expect(r1.status).toBe(200);
    const doks = await prisma.dokument.findMany({ where: { akteId: akte.id } });
    expect(doks).toHaveLength(1);
    expect(doks[0]).toMatchObject({ status: "FREIGEGEBEN", ordner: "beA", tags: ["beA"], createdById: anwalt.id });

    for (const ziel of [akte2.id, null]) {
      const r = await PATCH(req("/x", { method: "PATCH", json: { akteId: ziel } }), params({ id: n.id }));
      expect(r.status).toBe(409);
      expect((await r.json()).error).toBe(
        "Die Anhänge liegen bereits als Dokumente in einer anderen Akte. Bitte dort zuerst entfernen.",
      );
    }
    expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: n.id } })).akteId).toBe(akte.id);
    expect(await prisma.dokument.count()).toBe(1);
  });

  it("Umzuordnung ohne angelegte Dokumente bleibt möglich", async () => {
    const n = await nachricht({ akteId: akte.id, anhaenge: [] });
    asUser(anwalt);
    const r = await (await route()).PATCH(req("/x", { method: "PATCH", json: { akteId: akte2.id } }), params({ id: n.id }));
    expect(r.status).toBe(200);
  });
});

describe("Lesen und Anhang-Download", () => {
  it("zugeordnete Nachricht ist ohne Aktenzugriff nicht lesbar", async () => {
    const n = await nachricht({ akteId: akte.id });
    asUser(fremd);
    const r = await (await route()).GET(req(`/x?download=1.pdf`), params({ id: n.id }));
    expect(r.status).toBe(404);
    expect(await prisma.auditLog.count({ where: { aktion: "BEA_ANHANG_HERUNTERGELADEN" } })).toBe(0);
  });

  it("Download liefert die Datei und protokolliert erst nach dem Laden", async () => {
    const n = await nachricht({ akteId: akte.id });
    asUser(anwalt);
    const { GET } = await route();

    kaputt.aktiv = true;
    expect((await GET(req(`/x?download=1.pdf`), params({ id: n.id }))).status).toBe(500);
    expect(await prisma.auditLog.count({ where: { aktion: "BEA_ANHANG_HERUNTERGELADEN" } })).toBe(0);

    kaputt.aktiv = false;
    const r = await GET(req(`/x?download=1.pdf`), params({ id: n.id }));
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe("%PDF");
    await vi.waitFor(async () =>
      expect(await prisma.auditLog.count({ where: { aktion: "BEA_ANHANG_HERUNTERGELADEN" } })).toBe(1),
    );
  });
});

describe("POST /api/bea/sync", () => {
  it("reiht den Abruf mit stabiler Job-ID je Benutzer ein", async () => {
    await prisma.beaZertifikat.create({
      data: {
        userId: anwalt.id, p12Verschluesselt: "x", pinVerschluesselt: "x", seriennummer: "1",
        inhaber: "RA", gueltigBis: new Date(Date.now() + 86_400_000),
      },
    });
    asUser(anwalt);
    const { POST } = await import("@/app/api/bea/sync/route");
    expect((await POST()).status).toBe(202);
    expect(queueAdd).toHaveBeenCalledWith("bea-sync", { userId: anwalt.id }, expect.objectContaining({ jobId: `bea-sync-${anwalt.id}` }));
  });

  it("ohne Zertifikat → 409", async () => {
    asUser(anwalt);
    const { POST } = await import("@/app/api/bea/sync/route");
    expect((await POST()).status).toBe(409);
  });
});
