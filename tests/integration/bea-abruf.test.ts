import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createUser, createAkte, asUser, req, params } from "./helpers";

const { dateien, queueAdd, queueGetJob, kaputt } = vi.hoisted(() => ({
  dateien: new Map<string, Buffer>(),
  queueAdd: vi.fn(async () => ({})),
  queueGetJob: vi.fn(async (): Promise<{ getState: () => Promise<string> } | undefined> => undefined),
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
vi.mock("@/lib/queue/queues", () => ({ ocrQueue: { add: queueAdd }, beaSyncQueue: { add: queueAdd, getJob: queueGetJob } }));
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
  queueGetJob.mockReset();
  queueGetJob.mockResolvedValue(undefined);
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

describe("PATCH /api/bea/messages/[id] – Zugriff und eEB-Status", () => {
  it("ohne Zugriff auf die aktuelle Akte → keine Änderung (auch nicht in die eigene Akte)", async () => {
    const n = await nachricht({ akteId: akte.id, anhaenge: [] });
    const eigene = await createAkte({ anwaltId: fremd.id });
    asUser(fremd);
    const { PATCH } = await route();
    for (const json of [{ akteId: eigene.id }, { akteId: null }, { status: "GELESEN" }, { eebStatus: "NICHT_ERFORDERLICH" }]) {
      const r = await PATCH(req("/x", { method: "PATCH", json }), params({ id: n.id }));
      expect(r.status).toBeGreaterThanOrEqual(403);
      expect(r.status).toBeLessThan(500);
    }
    const danach = await prisma.beaNachricht.findUniqueOrThrow({ where: { id: n.id } });
    expect(danach.akteId).toBe(akte.id);
    expect(danach.status).toBe("EINGANG");
  });

  it("eEB-Status nach Abgabe (BESTAETIGT / WIRD_ABGEGEBEN) nicht mehr änderbar → 409", async () => {
    asUser(anwalt);
    const { PATCH } = await route();
    for (const eebStatus of ["BESTAETIGT", "WIRD_ABGEGEBEN"]) {
      const n = await nachricht({ akteId: akte.id, eebAngefordert: true, eebStatus });
      const r = await PATCH(req("/x", { method: "PATCH", json: { eebStatus: "NICHT_ERFORDERLICH" } }), params({ id: n.id }));
      expect(r.status).toBe(409);
      expect((await r.json()).error).toBe("Der eEB-Status kann nach einer Abgabe nicht mehr geändert werden.");
      expect((await prisma.beaNachricht.findUniqueOrThrow({ where: { id: n.id } })).eebStatus).toBe(eebStatus);
    }
    const offen = await nachricht({ akteId: akte.id, eebAngefordert: true, eebStatus: "AUSSTEHEND" });
    const r = await PATCH(req("/x", { method: "PATCH", json: { eebStatus: "NICHT_ERFORDERLICH" } }), params({ id: offen.id }));
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

  it("laufender Abruf desselben Benutzers → 409 „Abruf läuft bereits“, nicht erneut eingereiht", async () => {
    await prisma.beaZertifikat.create({
      data: {
        userId: anwalt.id, p12Verschluesselt: "x", pinVerschluesselt: "x", seriennummer: "1",
        inhaber: "RA", gueltigBis: new Date(Date.now() + 86_400_000),
      },
    });
    queueGetJob.mockResolvedValue({ getState: async () => "active" });
    asUser(anwalt);
    const { POST } = await import("@/app/api/bea/sync/route");
    const r = await POST();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("Abruf läuft bereits");
    expect(queueGetJob).toHaveBeenCalledWith(`bea-sync-${anwalt.id}`);
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

describe("GET /api/bea/messages – Richtung", () => {
  it("filtert serverseitig nach richtung und lehnt ungültige Werte ab", async () => {
    await nachricht({ richtung: "EINGANG", betreff: "Eingang" });
    await nachricht({ richtung: "AUSGANG", betreff: "Ausgang", status: "GESENDET" });
    asUser(anwalt);
    const { GET } = await import("@/app/api/bea/messages/route");

    const aus = await (await GET(req("/x?richtung=AUSGANG") as any)).json();
    expect(aus.nachrichten.map((n: any) => n.betreff)).toEqual(["Ausgang"]);
    expect(aus.total).toBe(1);

    const ein = await (await GET(req("/x?richtung=EINGANG") as any)).json();
    expect(ein.nachrichten.map((n: any) => n.betreff)).toEqual(["Eingang"]);

    expect((await GET(req("/x?richtung=SEITWAERTS") as any)).status).toBe(400);
  });
});

describe("Übersprungene beA-Nachrichten (Status und Zurücksetzen)", () => {
  const SAFE = `DE.BRAK.int-${Date.now()}`;

  async function redisDirekt() {
    const { createRedisConnection } = await import("@/lib/redis");
    return createRedisConnection({ maxRetriesPerRequest: 1 });
  }

  async function zertifikatMitPostfach(userId: string) {
    await prisma.beaZertifikat.create({
      data: {
        userId, p12Verschluesselt: "x", pinVerschluesselt: "x", seriennummer: "1",
        inhaber: "RA", gueltigBis: new Date(Date.now() + 86_400_000), safeId: SAFE,
      },
    });
  }

  it("GET /api/bea/status liefert uebersprungen für das Postfach des Zertifikats", async () => {
    const r = await redisDirekt();
    try {
      await r.del(`bea:uebersprungen:${SAFE}`);
      await zertifikatMitPostfach(anwalt.id);
      asUser(anwalt);
      const { GET } = await import("@/app/api/bea/status/route");
      expect((await (await GET()).json()).uebersprungen).toBe(0);

      await r.sadd(`bea:uebersprungen:${SAFE}`, "m1", "m2");
      const body = await (await GET()).json();
      expect(body.uebersprungen).toBe(2);
      expect(JSON.stringify(body)).not.toContain("p12");
    } finally {
      await r.del(`bea:uebersprungen:${SAFE}`);
      r.disconnect();
    }
  });

  it("POST /api/bea/fehlversuche/zuruecksetzen: nur ADMIN, löscht Zähler und Set, Audit-Eintrag", async () => {
    const r = await redisDirekt();
    try {
      await r.set(`bea:fehlversuch:${SAFE}:m1`, "3");
      await r.set(`bea:fehlversuch:${SAFE}:m2`, "1");
      await r.set(`bea:fehlversuch:DE.anderes:m1`, "3");
      await r.sadd(`bea:uebersprungen:${SAFE}`, "m1");
      const { POST } = await import("@/app/api/bea/fehlversuche/zuruecksetzen/route");

      asUser(anwalt);
      expect((await POST(req("/x", { method: "POST", json: { postfachSafeId: SAFE } }) as any)).status).toBe(403);
      expect(await r.exists(`bea:fehlversuch:${SAFE}:m1`)).toBe(1);

      const admin = await createUser("ADMIN");
      asUser(admin);
      expect((await POST(req("/x", { method: "POST", json: {} }) as any)).status).toBe(400);
      const res = await POST(req("/x", { method: "POST", json: { postfachSafeId: SAFE } }) as any);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ freigegeben: 1 });
      expect(await r.exists(`bea:fehlversuch:${SAFE}:m1`, `bea:fehlversuch:${SAFE}:m2`, `bea:uebersprungen:${SAFE}`)).toBe(0);
      expect(await r.exists(`bea:fehlversuch:DE.anderes:m1`)).toBe(1);

      const audit = await prisma.auditLog.findFirst({ where: { aktion: "BEA_FEHLVERSUCHE_ZURUECKGESETZT", userId: admin.id } });
      expect(audit?.details).toMatchObject({ postfachSafeId: SAFE, freigegeben: 1 });
    } finally {
      await r.del(`bea:fehlversuch:${SAFE}:m1`, `bea:fehlversuch:${SAFE}:m2`, `bea:fehlversuch:DE.anderes:m1`, `bea:uebersprungen:${SAFE}`);
      r.disconnect();
    }
  });
});
