import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- in-memory fakes (hoisted: used inside vi.mock factories) ----------

const { nachrichten, dokumente, dateien, zert, store, mengen, zertPin, prismaFake } = vi.hoisted(() => {
  interface Zeile { id: string; [k: string]: unknown }
  const nachrichten = new Map<string, Zeile>();
  const dokumente: Zeile[] = [];
  const dateien = new Map<string, Buffer>();
  const zert = { status: "AKTIV" as "AKTIV" | "FEHLER", letzterAbruf: null as Date | null };
  let idZaehler = 0;

  function p2002() {
    return Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["nachrichtenId"] } });
  }

  const prismaFake = {
    beaNachricht: {
      findMany: vi.fn(async ({ where }: { where: { nachrichtenId: { in: string[] } } }) =>
        [...nachrichten.values()]
          .filter((n) => where.nachrichtenId.in.includes(n.nachrichtenId as string))
          .map((n) => ({ nachrichtenId: n.nachrichtenId })),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if ([...nachrichten.values()].some((n) => n.nachrichtenId === data.nachrichtenId)) throw p2002();
        const z = { id: `bn-${++idZaehler}`, akteId: null, ...data };
        nachrichten.set(z.id, z);
        return z;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const z = nachrichten.get(where.id)!;
        Object.assign(z, data);
        return z;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; nachrichtenId?: string } }) =>
        where.id
          ? nachrichten.get(where.id) ?? null
          : [...nachrichten.values()].find((n) => n.nachrichtenId === where.nachrichtenId) ?? null,
      ),
    },
    akte: {
      findUnique: vi.fn(async () => ({ id: "akte-1", anwaltId: "anwalt-1", sachbearbeiterId: null })),
    },
    dokument: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const d = { id: `dok-${++idZaehler}`, ...data };
        dokumente.push(d);
        return d;
      }),
    },
    beaZertifikat: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(zert, data);
        return { count: 1 };
      }),
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => [{ userId: "u1" }]),
    },
  };
  const store = new Map<string, string>();
  const mengen = new Map<string, Set<string>>();
  const zertPin = { pin: "1234" };
  return { nachrichten, dokumente, dateien, zert, store, mengen, zertPin, prismaFake };
});
vi.mock("@/lib/db", () => ({ prisma: prismaFake }));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(async (key: string, body: Buffer) => {
    dateien.set(key, Buffer.from(body));
    return key;
  }),
  getFileStream: vi.fn(async (key: string) => {
    const b = dateien.get(key);
    return b ? { transformToByteArray: async () => new Uint8Array(b) } : undefined;
  }),
  generateStorageKey: (akteId: string, name: string) => `akten/${akteId}/dokumente/${name}`,
}));

vi.mock("@/lib/queue/queues", () => ({
  ocrQueue: { add: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/audit", () => ({ logAuditEvent: vi.fn(async () => ({})) }));
vi.mock("../auto-assign", () => ({ autoAssignToAkte: vi.fn() }));

// Session layer runs for real against fake Redis and a fake certificate store.
vi.mock("@/lib/redis", () => ({
  createRedisConnection: () => ({
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => (store.set(k, v), "OK"),
    del: async (...ks: string[]) => ks.filter((k) => store.delete(k) || mengen.delete(k)).length,
    sadd: async (k: string, v: string) => {
      const m = mengen.get(k) ?? new Set<string>();
      mengen.set(k, m);
      return m.has(v) ? 0 : (m.add(v), 1);
    },
    srem: async (k: string, v: string) => (mengen.get(k)?.delete(v) ? 1 : 0),
    scard: async (k: string) => mengen.get(k)?.size ?? 0,
    scan: async (_c: string, _m: string, muster: string) => {
      const praefix = muster.replace(/\\(.)/g, "$1").replace(/\*$/, "");
      return ["0", [...store.keys()].filter((k) => k.startsWith(praefix))];
    },
    incr: async (k: string) => {
      const v = String(Number(store.get(k) ?? 0) + 1);
      store.set(k, v);
      return Number(v);
    },
    expire: async () => 1,
  }),
}));
vi.mock("@/lib/email/crypto", () => ({
  encryptCredential: (s: string) => s,
  decryptCredential: (s: string) => s,
}));
vi.mock("../zertifikat", () => {
  const markiereZertifikatFehler = vi.fn(async (_u: string, meldung: string) => {
    zert.status = "FEHLER";
    void meldung;
  });
  return {
    // Mirrors the real local check (tested in zertifikat.test.ts): a PIN that no
    // longer opens the p12 marks the certificate FEHLER and yields null.
    ladeZertifikat: vi.fn(async (u: string) => {
      if (zert.status !== "AKTIV") return null;
      if (zertPin.pin === "falsch") {
        await markiereZertifikatFehler(u, "beA-Anmeldung fehlgeschlagen: PIN falsch");
        return null;
      }
      return { p12: Buffer.from("p12"), pin: zertPin.pin };
    }),
    markiereZertifikatFehler,
    setzeZertifikatSafeId: vi.fn(async () => {}),
  };
});
vi.mock("@/lib/socket/emitter", () => ({ safeEmit: vi.fn() }));
vi.mock("../provider", () => ({ getBeaProvider: vi.fn() }));

import { getBeaProvider, type BeaNachrichtVoll } from "../provider";
import { MockProvider } from "../mock-provider";
import { autoAssignToAkte } from "../auto-assign";
import { ocrQueue } from "@/lib/queue/queues";
import { logAuditEvent } from "@/lib/audit";
import { markiereZertifikatFehler } from "../zertifikat";
import { rufeZertifikatAb, speichereEingang, legeDokumenteAn } from "../abruf";
import { processBeaSync } from "@/lib/queue/processors/bea-sync.processor";
import { safeEmit } from "@/lib/socket/emitter";

const SAFE = "DE.BRAK.kanzlei";

function nachricht(id: string, extra: Partial<BeaNachrichtVoll> = {}): BeaNachrichtVoll {
  return {
    messageId: id,
    osciMessageId: null,
    betreff: `Betreff ${id} Müller ß €`,
    text: "Text",
    absender: { safeId: "DE.Justiz.lg", name: "LG Berlin" },
    empfaenger: [{ safeId: SAFE, name: "Kanzlei" }],
    aktenzeichenAbsender: null,
    aktenzeichenJustiz: "1 O 1/26",
    empfangenAm: new Date("2026-11-19T10:00:00Z"),
    eebAngefordert: false,
    vertraulich: false,
    dringend: false,
    anhaenge: [
      { name: "Schriftsatz.pdf", mimeType: "application/pdf", inhalt: Buffer.from("%PDF"), typ: "SCHRIFTSATZ" },
      { name: "Anlage.pdf", mimeType: "application/pdf", inhalt: Buffer.from("%PDF2"), typ: "ATTACHMENT" },
    ],
    ...extra,
  };
}

let provider: MockProvider;

function mitProvider(liste: BeaNachrichtVoll[]) {
  provider = new MockProvider({ postfaecher: [{ safeId: SAFE, name: "Kanzlei", typ: "" }], nachrichten: liste });
  vi.mocked(getBeaProvider).mockReturnValue(provider);
}

beforeEach(() => {
  vi.clearAllMocks();
  nachrichten.clear();
  dokumente.length = 0;
  dateien.clear();
  store.clear();
  mengen.clear();
  zert.status = "AKTIV";
  zert.letzterAbruf = null;
  zertPin.pin = "1234";
  vi.mocked(autoAssignToAkte).mockResolvedValue({ akteId: null, confidence: "UNSICHER", reason: "" });
  mitProvider([nachricht("m1"), nachricht("m2")]);
});

describe("rufeZertifikatAb", () => {
  it("legt zwei neue Nachrichten an und lädt ihre Anhänge nach bea/<safeId>/<messageId>/ hoch", async () => {
    const r = await rufeZertifikatAb("u1");
    expect(r).toEqual({ neu: 2, fehler: [] });
    expect(nachrichten.size).toBe(2);
    expect(dateien.has(`bea/${SAFE}/m1/Schriftsatz.pdf`)).toBe(true);
    expect(dateien.has(`bea/${SAFE}/m2/Anlage.pdf`)).toBe(true);
    expect(dateien.has(`bea/${SAFE}/m1/nachricht.json`)).toBe(true);

    const z = [...nachrichten.values()].find((n) => n.nachrichtenId === "m1")!;
    expect(z).toMatchObject({
      status: "EINGANG",
      richtung: "EINGANG",
      postfachSafeId: SAFE,
      safeIdAbsender: "DE.Justiz.lg",
      safeIdEmpfaenger: SAFE,
      absender: "LG Berlin",
      empfaenger: "Kanzlei",
      betreff: "Betreff m1 Müller ß €",
      inhalt: "Text",
      eebStatus: null,
      aktenzeichenJustiz: "1 O 1/26",
      exportPfad: `bea/${SAFE}/m1/nachricht.json`,
    });
    const anhaenge = z.anhaenge as { name: string; storageKey: string; groesse: number }[];
    expect(anhaenge.map((a) => a.storageKey)).toEqual([
      `bea/${SAFE}/m1/Schriftsatz.pdf`,
      `bea/${SAFE}/m1/Anlage.pdf`,
    ]);

    // nachricht.json carries metadata and references, never contents
    const json = dateien.get(`bea/${SAFE}/m1/nachricht.json`)!.toString("utf8");
    expect(json).toContain("Schriftsatz.pdf");
    expect(json).not.toContain(Buffer.from("%PDF").toString("base64"));
    expect(zert.letzterAbruf).toBeInstanceOf(Date);

    // audit without subject or content
    const audit = vi.mocked(logAuditEvent).mock.calls.map((c) => c[0]);
    expect(audit.filter((a) => a.aktion === "BEA_NACHRICHT_EMPFANGEN")).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toContain("Betreff");
    expect(JSON.stringify(audit)).not.toContain("Text");
  });

  it("überspringt bereits vorhandene nachrichtenId (holeNachricht nicht aufgerufen)", async () => {
    nachrichten.set("x", { id: "x", nachrichtenId: "m1" });
    const hole = vi.spyOn(provider, "holeNachricht");
    const r = await rufeZertifikatAb("u1");
    expect(r.neu).toBe(1);
    expect(hole).toHaveBeenCalledTimes(1);
    expect(hole.mock.calls[0][1]).toBe("m2");
  });

  it("wählt den Ordner vom Typ INBOX, sonst den Ordner „Posteingang“", async () => {
    const liste = vi.spyOn(provider, "listeNachrichten");
    vi.spyOn(provider, "listeOrdner").mockResolvedValueOnce([
      { id: "gesendet", name: "Gesendet", typ: "OUTBOX", parentId: null },
      { id: "eingang", name: "Posteingang", typ: "INBOX", parentId: null },
    ]);
    await rufeZertifikatAb("u1");
    expect(liste.mock.calls[0][1]).toBe("eingang");

    nachrichten.clear();
    vi.spyOn(provider, "listeOrdner").mockResolvedValueOnce([
      { id: "a", name: "Papierkorb", typ: "", parentId: null },
      { id: "b", name: "Posteingang", typ: "", parentId: null },
    ]);
    await rufeZertifikatAb("u1");
    expect(liste.mock.calls[1][1]).toBe("b");
  });

  it("Anmeldung von bea.expert abgelehnt (401) → Ausfall: fehler[], Zertifikat bleibt AKTIV", async () => {
    zertPin.pin = "falsch-beim-dienst";
    const { BeaExpertError } = await import("../expert/transport");
    vi.spyOn(provider, "anmelden").mockRejectedValue(new BeaExpertError("abgelehnt", "bex_login_step2", 401));
    const r = await rufeZertifikatAb("u1");
    expect(r.fehler).toHaveLength(1);
    expect(zert.status).toBe("AKTIV");
    expect(markiereZertifikatFehler).not.toHaveBeenCalled();
  });

  it("lokal ungültige PIN → keine Exception aus dem Job, Zertifikat FEHLER, kein zweiter Anmeldeversuch beim nächsten Lauf", async () => {
    zertPin.pin = "falsch";
    const anmelden = vi.spyOn(provider, "anmelden");
    await expect(rufeZertifikatAb("u1")).resolves.toEqual({ neu: 0, fehler: [] });
    expect(zert.status).toBe("FEHLER");
    expect(markiereZertifikatFehler).toHaveBeenCalledTimes(1);

    await expect(processBeaSync({ data: { userId: "u1" } } as never)).resolves.toBeUndefined();
    // the local check fails before bea.expert is contacted
    expect(anmelden).not.toHaveBeenCalled();
  });

  it("Ausfall von bea.expert → fehler[], Zertifikat bleibt AKTIV, Job schlägt fehl", async () => {
    const { BeaExpertError } = await import("../expert/transport");
    vi.spyOn(provider, "listePostfaecher").mockRejectedValue(new BeaExpertError("down", "bea_get_postboxes", 503));
    const r = await rufeZertifikatAb("u1");
    expect(r.fehler).toHaveLength(1);
    expect(zert.status).toBe("AKTIV");
    await expect(processBeaSync({ data: { userId: "u1" } } as never)).rejects.toThrow();
  });

  it("eine nicht lesbare Nachricht blockiert spätere nicht, der Job schlägt nicht fehl", async () => {
    const { BeaEntschluesselungError } = await import("../expert/eingang");
    const original = provider.holeNachricht.bind(provider);
    const hole = vi.spyOn(provider, "holeNachricht").mockImplementation(async (s, id) => {
      if (id === "m1") throw new BeaEntschluesselungError("kaputt", "bea_get_message");
      return original(s, id);
    });
    await expect(processBeaSync({ data: { userId: "u1" } } as never)).resolves.toBeUndefined();
    expect([...nachrichten.values()].map((n) => n.nachrichtenId)).toEqual(["m2"]);
    expect(store.get(`bea:fehlversuch:${SAFE}:m1`)).toBe("1");
    expect(zert.letzterAbruf).toBeInstanceOf(Date);

    // runs 2 and 3 try again; the 3rd failure is reported once; run 4 skips m1
    await rufeZertifikatAb("u1");
    await rufeZertifikatAb("u1");
    const meldungen = () =>
      vi.mocked(logAuditEvent).mock.calls.filter((c) => c[0].aktion === "BEA_NACHRICHT_FEHLER");
    expect(meldungen()).toHaveLength(1);
    expect(JSON.stringify(meldungen()[0][0].details)).not.toContain("Betreff");
    const vorher = hole.mock.calls.filter((c) => c[1] === "m1").length;
    await rufeZertifikatAb("u1");
    expect(hole.mock.calls.filter((c) => c[1] === "m1").length).toBe(vorher);
    expect(meldungen()).toHaveLength(1);

    // skipped: recorded per postbox and admins notified once with ids only
    expect([...(mengen.get(`bea:uebersprungen:${SAFE}`) ?? [])]).toEqual(["m1"]);
    expect(safeEmit).toHaveBeenCalledTimes(1);
    const [raum, ereignis, payload] = vi.mocked(safeEmit).mock.calls[0];
    expect(raum).toBe("role:ADMIN");
    expect(ereignis).toBe("notification");
    expect(payload).toMatchObject({
      message: "beA-Nachricht konnte nicht übernommen werden – bitte im beA-Webclient prüfen",
      data: { postfachSafeId: SAFE, messageId: "m1" },
    });
    expect(JSON.stringify(payload)).not.toContain("Betreff");

    // admin reset: counters and set cleared, next run fetches m1 again
    const { setzePostfachFehlversucheZurueck, anzahlUebersprungen } = await import("../fehlversuche");
    expect(await anzahlUebersprungen(SAFE)).toBe(1);
    expect(await setzePostfachFehlversucheZurueck(SAFE)).toBe(1);
    expect(await anzahlUebersprungen(SAFE)).toBe(0);
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
    hole.mockImplementation(original);
    await rufeZertifikatAb("u1");
    expect([...nachrichten.values()].map((n) => n.nachrichtenId).sort()).toEqual(["m1", "m2"]);
  });

  it("Ausfall beim Holen einer Nachricht → Abbruch, fehler[], Job schlägt fehl, kein Fehlversuch gezählt", async () => {
    const { BeaExpertError } = await import("../expert/transport");
    vi.spyOn(provider, "holeNachricht").mockRejectedValue(new BeaExpertError("Zeitüberschreitung", "bea_get_message"));
    const hole = vi.mocked(provider.holeNachricht);
    const r = await rufeZertifikatAb("u1");
    expect(r.fehler).toHaveLength(1);
    // aborted after m1 (2 calls: first try + retry), m2 not attempted
    expect(hole.mock.calls.every((c) => c[1] === "m1")).toBe(true);
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
    await expect(processBeaSync({ data: { userId: "u1" } } as never)).rejects.toThrow();
  });

  it("Speicherfehler (MinIO) → Abbruch, Job schlägt fehl, kein Fehlversuch gezählt", async () => {
    const { uploadFile } = await import("@/lib/storage");
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error("MinIO nicht erreichbar"));
    const r = await rufeZertifikatAb("u1");
    expect(r.fehler).toHaveLength(1);
    expect(nachrichten.size).toBe(0); // aborted before m2
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error("MinIO nicht erreichbar"));
    await expect(processBeaSync({ data: { userId: "u1" } } as never)).rejects.toThrow();
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
  });

  it("Datenbankfehler beim Anlegen → Abbruch ohne Fehlversuch", async () => {
    prismaFake.beaNachricht.create.mockRejectedValueOnce(new Error("Verbindung zur Datenbank verloren"));
    const r = await rufeZertifikatAb("u1");
    expect(r.fehler).toHaveLength(1);
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
  });

  it("4xx-Antwort für eine Nachricht zählt gegen die Nachricht, Job läuft weiter", async () => {
    const { BeaExpertError } = await import("../expert/transport");
    const original = provider.holeNachricht.bind(provider);
    vi.spyOn(provider, "holeNachricht").mockImplementation(async (s, id) => {
      if (id === "m1") throw new BeaExpertError("nicht gefunden", "bea_get_message", 404);
      return original(s, id);
    });
    await expect(processBeaSync({ data: { userId: "u1" } } as never)).resolves.toBeUndefined();
    expect(store.get(`bea:fehlversuch:${SAFE}:m1`)).toBe("1");
    expect(nachrichten.size).toBe(1);
  });

  it("setzeFehlversucheZurueck löscht den Zähler", async () => {
    const { setzeFehlversucheZurueck } = await import("../fehlversuche");
    store.set(`bea:fehlversuch:${SAFE}:m1`, "3");
    await setzeFehlversucheZurueck(SAFE, "m1");
    expect(store.has(`bea:fehlversuch:${SAFE}:m1`)).toBe(false);
  });

  it("kein Posteingang → nur Warnung, kein Jobfehler", async () => {
    vi.spyOn(provider, "listeOrdner").mockResolvedValue([{ id: "x", name: "Gesendet", typ: "OUTBOX", parentId: null }]);
    await expect(rufeZertifikatAb("u1")).resolves.toEqual({ neu: 0, fehler: [] });
  });

  it("unerwarteter Fehler bei einem Benutzer stoppt die übrigen nicht, Job schlägt am Ende fehl", async () => {
    prismaFake.beaZertifikat.findMany.mockResolvedValueOnce([{ userId: "u0" }, { userId: "u1" }]);
    // u0's first database access throws (not caught inside rufeZertifikatAb)
    prismaFake.beaNachricht.findMany.mockRejectedValueOnce(new Error("Datenbank weg"));
    await expect(processBeaSync({ data: {} } as never)).rejects.toThrow(/u0: Datenbank weg/);
    expect(nachrichten.size).toBe(2);
  });

  it("Job ohne userId läuft über alle AKTIV-Zertifikate", async () => {
    await processBeaSync({ data: {} } as never);
    expect(prismaFake.beaZertifikat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "AKTIV" } }),
    );
    expect(nachrichten.size).toBe(2);
  });
});

describe("speichereEingang", () => {
  it("P2002 bei parallelem Abruf ergibt { neu: false } statt Fehler", async () => {
    const n = nachricht("m9");
    const [a, b] = await Promise.all([speichereEingang(n, SAFE, "u1"), speichereEingang(n, SAFE, "u2")]);
    expect([a.neu, b.neu].sort()).toEqual([false, true]);
    expect(nachrichten.size).toBe(1);
  });

  it("SICHER zugeordnete Nachricht → status ZUGEORDNET, Dokumente FREIGEGEBEN mit Tag beA, OCR eingereiht", async () => {
    vi.mocked(autoAssignToAkte).mockResolvedValue({ akteId: "akte-1", confidence: "SICHER", reason: "Az" });
    const r = await speichereEingang(nachricht("m1"), SAFE, "u1");
    const z = nachrichten.get(r.id)!;
    expect(z.status).toBe("ZUGEORDNET");
    expect(z.akteId).toBe("akte-1");
    expect(dokumente).toHaveLength(2);
    for (const d of dokumente) {
      expect(d).toMatchObject({
        akteId: "akte-1",
        status: "FREIGEGEBEN",
        erstelltDurch: "system",
        ordner: "beA",
        tags: ["beA"],
        createdById: "u1",
      });
    }
    expect(ocrQueue.add).toHaveBeenCalledTimes(2);
    expect((z.anhaenge as { dokumentId?: string }[]).every((a) => a.dokumentId)).toBe(true);
  });

  it("WAHRSCHEINLICH zugeordnet → bleibt EINGANG ohne Akte", async () => {
    vi.mocked(autoAssignToAkte).mockResolvedValue({ akteId: "akte-1", confidence: "WAHRSCHEINLICH", reason: "" });
    const r = await speichereEingang(nachricht("m1"), SAFE, "u1");
    expect(nachrichten.get(r.id)).toMatchObject({ status: "EINGANG", akteId: null });
    expect(dokumente).toHaveLength(0);
  });

  it("nicht zugeordnete Nachricht → keine Dokumente; legeDokumenteAn bei späterer Zuordnung legt sie an", async () => {
    const r = await speichereEingang(nachricht("m1"), SAFE, "u1");
    expect(dokumente).toHaveLength(0);
    expect(dateien.has(`bea/${SAFE}/m1/Schriftsatz.pdf`)).toBe(true);

    const anzahl = await legeDokumenteAn(r.id, "akte-1", "u7");
    expect(anzahl).toBe(2);
    expect(dokumente.map((d) => d.name)).toEqual(["Schriftsatz.pdf", "Anlage.pdf"]);
    expect(dokumente[0].createdById).toBe("u7");
    expect(dateien.get(dokumente[0].dateipfad as string)?.toString()).toBe("%PDF");
  });

  it("legeDokumenteAn zweimal → Dokumente nur einmal", async () => {
    const r = await speichereEingang(nachricht("m1"), SAFE, "u1");
    expect(await legeDokumenteAn(r.id, "akte-1")).toBe(2);
    expect(await legeDokumenteAn(r.id, "akte-1")).toBe(0);
    expect(dokumente).toHaveLength(2);
    // without userId the Akte's lawyer becomes creator
    expect(dokumente[0].createdById).toBe("anwalt-1");
  });

  it("xjustiz_nachricht.xml wird geparst, xjustizNachrichtenId gesetzt", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tns:nachricht.gds.uebermittlungSchriftgutobjekte.0005005 xmlns:tns="http://www.xjustiz.de">
  <tns:nachrichtenkopf xjustizVersion="3.4.1">
    <tns:eigeneNachrichtenID>abc-123</tns:eigeneNachrichtenID>
  </tns:nachrichtenkopf>
</tns:nachricht.gds.uebermittlungSchriftgutobjekte.0005005>`;
    const n = nachricht("m1", {
      anhaenge: [{ name: "xjustiz_nachricht.xml", mimeType: "application/xml", inhalt: Buffer.from(xml), typ: null }],
    });
    const r = await speichereEingang(n, SAFE, "u1");
    const z = nachrichten.get(r.id)!;
    expect(z.xjustizNachrichtenId).toBe("abc-123");
    expect(z.xjustizData).toMatchObject({ nachrichtenId: "abc-123" });
  });

  it("bereinigt Dateinamen und vergibt bei gleichen Namen eindeutige Schlüssel", async () => {
    const n = nachricht("m1", {
      eebAngefordert: true,
      anhaenge: [
        { name: "../../etc/passwd", mimeType: "text/plain", inhalt: Buffer.from("a"), typ: null },
        { name: "Anlage.pdf", mimeType: "application/pdf", inhalt: Buffer.from("b"), typ: null },
        { name: "Anlage.pdf", mimeType: "application/pdf", inhalt: Buffer.from("c"), typ: null },
      ],
    });
    const r = await speichereEingang(n, SAFE, "u1");
    const z = nachrichten.get(r.id)!;
    expect(z.eebStatus).toBe("AUSSTEHEND");
    const keys = (z.anhaenge as { storageKey: string }[]).map((a) => a.storageKey);
    expect(new Set(keys).size).toBe(3);
    for (const k of keys) {
      expect(k.startsWith(`bea/${SAFE}/m1/`)).toBe(true);
      expect(k.slice(`bea/${SAFE}/m1/`.length)).not.toContain("/");
      expect(k).not.toContain("..");
    }
  });
});
