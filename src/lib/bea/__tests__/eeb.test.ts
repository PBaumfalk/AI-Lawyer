import { describe, it, expect, vi, beforeEach } from "vitest";

const { nachrichten, akten, store, zert, prismaFake, auditLog } = vi.hoisted(() => {
  interface Zeile { id: string; [k: string]: unknown }
  const nachrichten: Zeile[] = [];
  const akten: Zeile[] = [];
  const store = new Map<string, string>();
  const zert = { vorhanden: true };
  const prismaFake = {
    beaNachricht: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => nachrichten.find((n) => n.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; eebStatus: { notIn: string[] } | string }; data: Record<string, unknown> }) => {
        const n = nachrichten.find((x) => x.id === where.id);
        const s = n?.eebStatus as string;
        const ok = !!n && (typeof where.eebStatus === "string" ? s === where.eebStatus : !where.eebStatus.notIn.includes(s));
        if (ok) Object.assign(n!, data);
        return { count: ok ? 1 : 0 };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const n = nachrichten.find((x) => x.id === where.id)!;
        Object.assign(n, data);
        return n;
      }),
    },
    akte: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => akten.find((a) => a.id === where.id) ?? null),
    },
  };
  const auditLog = vi.fn(async () => ({}));
  return { nachrichten, akten, store, zert, prismaFake, auditLog };
});

vi.mock("@/lib/db", () => ({ prisma: prismaFake }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: auditLog }));
vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(async () => ({
    session: { user: { id: "u1", role: "ANWALT", email: "a@b", name: "RA", kanzleiId: null } },
  })),
  akteAccessDenied: vi.fn(async () => null),
}));
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
import { heuteBerlin } from "../regeln";
import { POST } from "@/app/api/bea/messages/[id]/eeb/route";

let provider: MockProvider;

function nachricht(extra: Record<string, unknown> = {}) {
  const n = {
    id: "n1", richtung: "EINGANG", eebAngefordert: true, eebStatus: "AUSSTEHEND",
    xjustizNachrichtenId: "xj-123", postfachSafeId: "DE.BRAK.kanzlei", safeIdAbsender: "DE.Justiz.ag",
    aktenzeichenJustiz: "12 C 34/26", aktenzeichenAbsender: "12 C 34/26", betreff: "Urteil Müller", akteId: "a1", ...extra,
  };
  nachrichten.length = 0;
  nachrichten.push(n);
  return n;
}

const post = (b: unknown, id = "n1") =>
  POST(new NextRequest(`http://localhost/api/bea/messages/${id}/eeb`, { method: "POST", body: JSON.stringify(b) }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  zert.vorhanden = true;
  akten.length = 0;
  akten.push({ id: "a1", aktenzeichen: "00042/26" });
  provider = new MockProvider();
  vi.mocked(getBeaProvider).mockReturnValue(provider);
  nachricht();
});

describe("POST /api/bea/messages/[id]/eeb – serverseitige Abgabe", () => {
  it("gibt eEB mit fremdId = xjustizNachrichtenId und Empfänger = Absender ab, setzt BESTAETIGT", async () => {
    const abgabe = vi.spyOn(provider, "gibEebAb");
    const res = await post({ abgabeDatum: heuteBerlin() });
    expect(res.status).toBe(200);
    expect(abgabe).toHaveBeenCalledTimes(1);
    expect(abgabe.mock.calls[0][1]).toEqual({
      postfachSafeId: "DE.BRAK.kanzlei",
      empfaengerSafeId: "DE.Justiz.ag",
      betreff: "Elektronisches Empfangsbekenntnis zu 12 C 34/26",
      aktenzeichenAbsender: "00042/26",
      aktenzeichenEmpfaenger: "12 C 34/26",
      fremdId: "xj-123",
      abgabeDatum: heuteBerlin(),
    });
    expect(nachrichten[0].eebStatus).toBe("BESTAETIGT");
    expect(nachrichten[0].eebDatum).toBeInstanceOf(Date);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ aktion: "BEA_EEB_BESTAETIGT" }));
  });

  it("verweigert eEB bei bereits BESTAETIGT (422), Provider nicht aufgerufen", async () => {
    nachricht({ eebStatus: "BESTAETIGT" });
    const abgabe = vi.spyOn(provider, "gibEebAb");
    const res = await post({ abgabeDatum: heuteBerlin() });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Für diese Nachricht kann kein eEB abgegeben werden");
    expect(abgabe).not.toHaveBeenCalled();
  });

  it("verweigert eEB ohne xjustizNachrichtenId (422)", async () => {
    nachricht({ xjustizNachrichtenId: null });
    const abgabe = vi.spyOn(provider, "gibEebAb");
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(422);
    expect(abgabe).not.toHaveBeenCalled();
  });

  it("verweigert ausgehende Nachrichten und fehlende Safe-IDs (422)", async () => {
    const abgabe = vi.spyOn(provider, "gibEebAb");
    nachricht({ richtung: "AUSGANG" });
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(422);
    nachricht({ safeIdAbsender: null });
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(422);
    expect(abgabe).not.toHaveBeenCalled();
  });

  it("verweigert Abgabedatum in der Zukunft (422)", async () => {
    const abgabe = vi.spyOn(provider, "gibEebAb");
    const res = await post({ abgabeDatum: "2099-01-01" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Das Abgabedatum darf nicht in der Zukunft liegen");
    expect(abgabe).not.toHaveBeenCalled();
    expect(nachrichten[0].eebStatus).toBe("AUSSTEHEND");
  });

  it("Provider-Fehler → 502, eebStatus unverändert, gibEebAb genau 1×", async () => {
    const abgabe = vi.spyOn(provider, "gibEebAb").mockRejectedValue(new Error("Timeout"));
    const res = await post({ abgabeDatum: heuteBerlin() });
    expect(res.status).toBe(502);
    expect(abgabe).toHaveBeenCalledTimes(1);
    expect(nachrichten[0].eebStatus).toBe("AUSSTEHEND");
    expect(prismaFake.beaNachricht.update).not.toHaveBeenCalled();
  });

  it("gleichzeitige zweite Anfrage → 409, gibEebAb nur 1×", async () => {
    let frei!: () => void;
    const abgabe = vi.spyOn(provider, "gibEebAb").mockImplementation(
      () => new Promise((r) => { frei = () => r({ messageId: "m" }); }),
    );
    const erste = post({ abgabeDatum: heuteBerlin() });
    await vi.waitFor(() => expect(abgabe).toHaveBeenCalledTimes(1));
    const zweite = await post({ abgabeDatum: heuteBerlin() });
    expect(zweite.status).toBe(409);
    expect((await zweite.json()).error).toBe("Das eEB wird bereits abgegeben oder wurde schon abgegeben.");
    frei();
    expect((await erste).status).toBe(200);
    expect(abgabe).toHaveBeenCalledTimes(1);
  });

  it("Provider-Fehler setzt den vorherigen Status zurück", async () => {
    vi.spyOn(provider, "gibEebAb").mockRejectedValue(new Error("x"));
    await post({ abgabeDatum: heuteBerlin() });
    expect(nachrichten[0].eebStatus).toBe("AUSSTEHEND");
  });

  it("Zertifikat fehlt nach dem Claim → 409 und Status zurückgesetzt", async () => {
    zert.vorhanden = false;
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(409);
    expect(nachrichten[0].eebStatus).toBe("AUSSTEHEND");
  });

  it("Speichern nach erfolgreicher Abgabe schlägt fehl → 200 mit Warnung, Status bleibt WIRD_ABGEGEBEN", async () => {
    prismaFake.beaNachricht.update.mockRejectedValueOnce(new Error("db down"));
    const res = await post({ abgabeDatum: heuteBerlin() });
    expect(res.status).toBe(200);
    expect((await res.json()).warnung).toBe("eEB wurde abgegeben, der Status konnte aber nicht gespeichert werden.");
    expect(nachrichten[0].eebStatus).toBe("WIRD_ABGEGEBEN");
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(409);
  });

  it("ohne Zertifikat → 409, ohne Provider → 503", async () => {
    zert.vorhanden = false;
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(409);
    vi.mocked(getBeaProvider).mockReturnValue(null);
    expect((await post({ abgabeDatum: heuteBerlin() })).status).toBe(503);
  });
});
