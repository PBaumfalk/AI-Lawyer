import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ---------- in-memory fakes (hoisted: used inside vi.mock factories) ----------

const { dokumente, nachrichten, dateien, store, zert, prismaFake, auditLog } = vi.hoisted(() => {
  interface Zeile { id: string; [k: string]: unknown }
  const dokumente: Zeile[] = [];
  const nachrichten: Zeile[] = [];
  const dateien = new Map<string, Buffer>();
  const store = new Map<string, string>();
  const zert = { vorhanden: true };
  let zaehler = 0;
  const prismaFake = {
    dokument: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        dokumente.filter((d) => where.id.in.includes(d.id)),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { id: { in: string[] }; status: string }; data: Record<string, unknown> }) => {
        const t = dokumente.filter((d) => where.id.in.includes(d.id) && d.status === where.status);
        t.forEach((d) => Object.assign(d, data));
        return { count: t.length };
      }),
    },
    beaNachricht: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const z = { id: `bn-${++zaehler}`, ...data };
        nachrichten.push(z);
        return z;
      }),
    },
  };
  const auditLog = vi.fn(async () => ({}));
  return { dokumente, nachrichten, dateien, store, zert, prismaFake, auditLog };
});

vi.mock("@/lib/db", () => ({ prisma: prismaFake }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: auditLog }));
vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    session: { user: { id: "u1", role: "ANWALT", email: "a@b", name: "RA", kanzleiId: null } },
  })),
  akteAccessDenied: vi.fn(async () => null),
  buildAkteAccessFilter: vi.fn(() => ({})),
}));
vi.mock("@/lib/storage", () => ({
  getFileStream: vi.fn(async (key: string) => {
    const b = dateien.get(key);
    return b ? { transformToByteArray: async () => new Uint8Array(b) } : undefined;
  }),
}));
// Session layer runs for real against fake Redis and a fake certificate store.
vi.mock("@/lib/redis", () => ({
  createRedisConnection: () => ({
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => (store.set(k, v), "OK"),
    del: async (k: string) => (store.delete(k) ? 1 : 0),
  }),
}));
vi.mock("@/lib/email/crypto", () => ({ encryptCredential: (s: string) => s, decryptCredential: (s: string) => s }));
vi.mock("../zertifikat", () => ({
  ladeZertifikat: vi.fn(async () => (zert.vorhanden ? { p12: Buffer.from("p12"), pin: "1234" } : null)),
  markiereZertifikatFehler: vi.fn(async () => {}),
  setzeZertifikatSafeId: vi.fn(async () => {}),
}));
vi.mock("../provider", () => ({ getBeaProvider: vi.fn() }));

import { NextRequest } from "next/server";
import { getBeaProvider } from "../provider";
import { MockProvider } from "../mock-provider";
import { BeaExpertError } from "../expert/transport";
import { requirePermission } from "@/lib/rbac";
import { buildEebBestaetigung, beaVersandSchema } from "../versand";
import { POST } from "@/app/api/bea/messages/route";
import { POST as PRUEFUNG } from "@/app/api/bea/messages/versand-pruefung/route";

const SAFE = "DE.BRAK.kanzlei";
let provider: MockProvider;

function dokument(id: string, extra: Record<string, unknown> = {}) {
  const d = {
    id, name: `${id}.pdf`, dateipfad: `akten/a1/${id}.pdf`, mimeType: "application/pdf", groesse: 4,
    status: "FREIGEGEBEN", freigegebenDurchId: "u1", ...extra,
  };
  dokumente.push(d);
  dateien.set(d.dateipfad, Buffer.from("%PDF"));
  return d;
}

const body = (extra: Record<string, unknown> = {}) => ({
  akteId: "a1",
  postfachSafeId: SAFE,
  empfaengerSafeIds: ["DE.Justiz.ag"],
  betreff: "Klage Müller ß €",
  text: "Anbei die Klage.",
  aktenzeichenAbsender: "00042/26",
  nachrichtenTyp: "ALLGEMEINE_NACHRICHT",
  eebAnfordern: false,
  dringend: false,
  anhaenge: [{ dokumentId: "d1", art: "SCHRIFTSATZ" }],
  alsEntwurf: false,
  ...extra,
});

const post = (b: unknown, route = POST) =>
  route(new NextRequest("http://localhost/api/bea/messages", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  vi.clearAllMocks();
  dokumente.length = 0;
  nachrichten.length = 0;
  dateien.clear();
  store.clear();
  zert.vorhanden = true;
  provider = new MockProvider();
  vi.mocked(getBeaProvider).mockReturnValue(provider);
  dokument("d1");
});

describe("POST /api/bea/messages – serverseitiger Versand", () => {
  it("POST sendet und speichert GESENDET mit nachrichtenId des Providers", async () => {
    const sende = vi.spyOn(provider, "sende");
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(sende).toHaveBeenCalledTimes(1);
    const auftrag = sende.mock.calls[0][1];
    expect(auftrag).toMatchObject({
      postfachSafeId: SAFE,
      empfaengerSafeIds: ["DE.Justiz.ag"],
      betreff: "Klage Müller ß €",
      aktenzeichenAbsender: "00042/26",
      nachrichtenTyp: "ALLGEMEINE_NACHRICHT",
    });
    expect(auftrag.anhaenge).toEqual([{ name: "d1.pdf", inhalt: Buffer.from("%PDF"), art: "SCHRIFTSATZ" }]);

    expect(nachrichten).toHaveLength(1);
    expect(nachrichten[0]).toMatchObject({
      richtung: "AUSGANG",
      status: "GESENDET",
      nachrichtenId: "mock-1",
      postfachSafeId: SAFE,
      akteId: "a1",
      betreff: "Klage Müller ß €",
    });
    expect(nachrichten[0].gesendetAm).toBeInstanceOf(Date);
    expect(dokumente[0].status).toBe("VERSENDET");
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ aktion: "BEA_NACHRICHT_GESENDET" }));
  });

  it("Entwurf: speichereEntwurf statt sende, Status EINGANG, Dokument bleibt FREIGEGEBEN", async () => {
    const sende = vi.spyOn(provider, "sende");
    const entwurf = vi.spyOn(provider, "speichereEntwurf");
    const res = await post(body({ alsEntwurf: true }));
    expect(res.status).toBe(201);
    expect(sende).not.toHaveBeenCalled();
    expect(entwurf).toHaveBeenCalledTimes(1);
    expect(nachrichten[0]).toMatchObject({ richtung: "AUSGANG", status: "EINGANG", gesendetAm: null });
    expect(dokumente[0].status).toBe("FREIGEGEBEN");
  });

  it("POST bei Provider-Fehler: genau ein sende-Aufruf, Status FEHLER, HTTP 502", async () => {
    const sende = vi
      .spyOn(provider, "sende")
      .mockRejectedValue(new BeaExpertError("Zeitüberschreitung", "bea_send_message_validation", null));
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(sende).toHaveBeenCalledTimes(1);
    expect(nachrichten).toHaveLength(1);
    expect(nachrichten[0]).toMatchObject({ richtung: "AUSGANG", status: "FEHLER", nachrichtenId: null });
    expect(nachrichten[0].inhalt).toContain("Versandstatus unklar – bitte im beA-Webclient prüfen");
    expect((await res.json()).error).toContain("Versandstatus unklar");
    expect(dokumente[0].status).toBe("FREIGEGEBEN");
  });

  it("unbekannter Fehler nach Versandbeginn → ebenfalls FEHLER und 502, kein zweiter Versuch", async () => {
    const sende = vi.spyOn(provider, "sende").mockRejectedValue(new TypeError("kaputt"));
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(sende).toHaveBeenCalledTimes(1);
    expect(nachrichten[0].status).toBe("FEHLER");
  });

  it("Versand ohne messageId gilt als unklar (FEHLER, 502)", async () => {
    vi.spyOn(provider, "sende").mockResolvedValue({ messageId: null });
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(nachrichten[0]).toMatchObject({ status: "FEHLER" });
    expect(dokumente[0].status).toBe("FREIGEGEBEN");
  });

  it("Ausfall vor dem Versand (Sitzungsprüfung) → 502, nichts gespeichert, sende nie aufgerufen", async () => {
    store.set("bea:sitzung:u1", JSON.stringify({ token: "t", sessionKey: "", safeId: SAFE }));
    vi.spyOn(provider, "pruefeSitzung").mockRejectedValue(new BeaExpertError("down", "bex_check", 503));
    const sende = vi.spyOn(provider, "sende");
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(sende).not.toHaveBeenCalled();
    expect(nachrichten).toHaveLength(0);
  });

  it("POST ohne Zertifikat → 409", async () => {
    zert.vorhanden = false;
    const sende = vi.spyOn(provider, "sende");
    const res = await post(body());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Für Ihren Benutzer ist kein gültiges beA-Softwarezertifikat hinterlegt");
    expect(sende).not.toHaveBeenCalled();
    expect(nachrichten).toHaveLength(0);
  });

  it("beA nicht eingerichtet (kein Provider) → 503", async () => {
    vi.mocked(getBeaProvider).mockReturnValue(null);
    const res = await post(body());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("beA ist nicht eingerichtet");
  });

  it("POST mit nicht freigegebenem Dokument → abgelehnt, Provider nicht aufgerufen", async () => {
    dokument("d2", { status: "ENTWURF", freigegebenDurchId: null });
    const sende = vi.spyOn(provider, "sende");
    const anmelden = vi.spyOn(provider, "anmelden");
    const res = await post(body({ anhaenge: [{ dokumentId: "d2", art: "ATTACHMENT" }] }));
    expect(res.status).toBe(400);
    expect(sende).not.toHaveBeenCalled();
    expect(anmelden).not.toHaveBeenCalled();
    expect(nachrichten).toHaveLength(0);
  });

  it("Zeichenverstoß → 422 mit fehler, warnungen, verstoesse; Provider nicht aufgerufen", async () => {
    const sende = vi.spyOn(provider, "sende");
    const res = await post(body({ betreff: "„Klage“" }));
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.fehler).toEqual([]);
    expect(j.warnungen).toEqual([]);
    expect(j.verstoesse.map((v: { codePoint: string }) => v.codePoint)).toEqual(["U+201E", "U+201C"]);
    expect(sende).not.toHaveBeenCalled();
  });

  it("eEB ohne Anhang → 422 mit Fehlertext", async () => {
    const res = await post(body({ eebAnfordern: true, anhaenge: [] }));
    expect(res.status).toBe(422);
    expect((await res.json()).fehler).toEqual([
      "Ein eEB kann nur für Nachrichten mit mindestens einem Anhang angefordert werden",
    ]);
  });

  it("ohne canSendBeA → Antwort der Berechtigungsprüfung, Provider nicht aufgerufen", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requirePermission).mockResolvedValueOnce({
      error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }),
    });
    const sende = vi.spyOn(provider, "sende");
    expect((await post(body())).status).toBe(403);
    expect(sende).not.toHaveBeenCalled();
  });

  it("ungültiges Schema → 400", async () => {
    expect((await post(body({ empfaengerSafeIds: [] }))).status).toBe(400);
    expect((await post(body({ nachrichtenTyp: "EEB" }))).status).toBe(400);
    expect(beaVersandSchema.safeParse(body()).success).toBe(true);
  });

  it("doppelt angehängtes Dokument → 400", async () => {
    const res = await post(body({ anhaenge: [{ dokumentId: "d1", art: "SCHRIFTSATZ" }, { dokumentId: "d1", art: "ATTACHMENT" }] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bea/messages/versand-pruefung", () => {
  it("liefert Fehler, Warnungen und Zeichenverstöße ohne beA-Aufruf", async () => {
    const anmelden = vi.spyOn(provider, "anmelden");
    const res = await post({ betreff: "", text: "a…", empfaengerSafeIds: [], anhaenge: [{ dokumentId: "d1", art: "SCHRIFTSATZ" }] }, PRUEFUNG);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(false);
    expect(j.fehler).toEqual(["Betreff fehlt", "Mindestens ein Empfänger ist erforderlich"]);
    expect(j.verstoesse).toEqual([{ feld: "text", zeichen: "…", codePoint: "U+2026", position: 1, ersatz: "..." }]);
    expect(anmelden).not.toHaveBeenCalled();
  });

  it("gültige Nachricht → ok", async () => {
    const res = await post(body(), PRUEFUNG);
    expect(await res.json()).toEqual({ ok: true, fehler: [], warnungen: [], verstoesse: [], errors: [] });
  });

  it("nicht freigegebenes Dokument → 400 mit errors", async () => {
    dokument("d2", { status: "ENTWURF", freigegebenDurchId: null });
    const res = await post(body({ anhaenge: [{ dokumentId: "d2", art: "SCHRIFTSATZ" }] }), PRUEFUNG);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.ok).toBe(false);
    expect(j.errors[0]).toMatchObject({ dokumentId: "d2", status: "ENTWURF" });
  });
});

describe("eEB-Vertrag (bis Task 11)", () => {
  it("bestätigtes eEB → Datensatz mit Nachrichten-ID und Datum; unbestätigt → Fehler", () => {
    const d = new Date("2026-11-18T10:00:00Z");
    expect(buildEebBestaetigung({ ok: true, data: { success: true } }, "bea-1", d)).toEqual({
      nachrichtenId: "bea-1",
      eebDatum: d.toISOString(),
    });
    expect(() => buildEebBestaetigung({ ok: false, error: "x" }, "bea-1", d)).toThrow();
  });
});

describe("beA-Seiten liegen im BeaSessionProvider", () => {
  const dir = path.resolve(__dirname, "../../../app/(dashboard)/bea");
  it("Layout stellt den Provider für /bea, /bea/compose und /bea/[id]", () => {
    const layout = fs.readFileSync(path.join(dir, "layout.tsx"), "utf8");
    expect(layout).toMatch(/<BeaSessionProvider>\s*\{children\}\s*<\/BeaSessionProvider>/);
    for (const p of ["compose/page.tsx", "[id]/page.tsx", "page.tsx"]) {
      expect(fs.existsSync(path.join(dir, p))).toBe(true);
    }
    expect(fs.readFileSync(path.join(dir, "page.tsx"), "utf8")).not.toMatch(/<BeaSessionProvider/);
  });
});
