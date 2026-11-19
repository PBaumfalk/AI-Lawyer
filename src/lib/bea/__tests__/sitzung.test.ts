import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, { v: string; ttl: number | null }>();
const fakeRedis = {
  get: vi.fn(async (k: string) => store.get(k)?.v ?? null),
  set: vi.fn(async (k: string, v: string, _ex?: string, ttl?: number) => {
    store.set(k, { v, ttl: ttl ?? null });
    return "OK";
  }),
  del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
};
vi.mock("@/lib/redis", () => ({ createRedisConnection: () => fakeRedis }));
vi.mock("@/lib/email/crypto", () => ({
  encryptCredential: (s: string) => "enc:" + Buffer.from(s).toString("hex"),
  decryptCredential: (s: string) => Buffer.from(s.slice(4), "hex").toString(),
}));
vi.mock("../zertifikat", () => ({
  ladeZertifikat: vi.fn(),
  markiereZertifikatFehler: vi.fn(),
  setzeZertifikatSafeId: vi.fn(),
}));
vi.mock("../provider", () => ({ getBeaProvider: vi.fn() }));

import { getBeaProvider } from "../provider";
import { ladeZertifikat, markiereZertifikatFehler, setzeZertifikatSafeId } from "../zertifikat";
import { MockProvider } from "../mock-provider";
import { BeaExpertError } from "../expert/transport";
import { mitBeaSitzung, verwerfeBeaSitzung, BeaNichtEingerichtetError } from "../sitzung";

let provider: MockProvider;
let anmelden: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  provider = new MockProvider();
  anmelden = vi.spyOn(provider, "anmelden");
  vi.mocked(getBeaProvider).mockReturnValue(provider);
  vi.mocked(ladeZertifikat).mockResolvedValue({ p12: Buffer.from("p12"), pin: "1234" });
});

describe("mitBeaSitzung", () => {
  it("meldet beim ersten Aufruf an und nutzt danach die Sitzung aus Redis (anmelden genau 1×)", async () => {
    await mitBeaSitzung("u1", async () => 1, { wiederholen: true });
    await mitBeaSitzung("u1", async () => 2, { wiederholen: true });
    expect(anmelden).toHaveBeenCalledTimes(1);
    expect(store.get("bea:sitzung:u1")?.ttl).toBe(600);
    expect(setzeZertifikatSafeId).toHaveBeenCalledWith("u1", "DE.Mock.safeid");
  });

  it("speichert die Sitzung verschlüsselt (Redis-Wert enthält das Token nicht im Klartext)", async () => {
    await mitBeaSitzung("u1", async () => 1, { wiederholen: true });
    const wert = store.get("bea:sitzung:u1")!.v;
    expect(wert).not.toContain("mock-token");
    expect(wert.startsWith("enc:")).toBe(true);
  });

  it("wiederholen:true – nach BeaExpertError neu anmelden und fn ein zweites Mal aufrufen", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new BeaExpertError("abgelaufen", "x", 401))
      .mockResolvedValueOnce("ok");
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(anmelden).toHaveBeenCalledTimes(2);
  });

  it("wiederholen:true – zweiter Fehler wird durchgereicht (fn höchstens 2×)", async () => {
    const fn = vi.fn().mockRejectedValue(new BeaExpertError("kaputt", "x", 500));
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).rejects.toBeInstanceOf(BeaExpertError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("wiederholen:true – andere Fehler werden nicht wiederholt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("anders"));
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).rejects.toThrow("anders");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("wiederholen:false – fn wird nach BeaExpertError NICHT erneut aufgerufen", async () => {
    const fn = vi.fn().mockRejectedValue(new BeaExpertError("timeout", "x"));
    await expect(mitBeaSitzung("u1", fn, { wiederholen: false })).rejects.toBeInstanceOf(BeaExpertError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("wiederholen:false – pruefeSitzung false führt vor fn zu neuer Anmeldung", async () => {
    await mitBeaSitzung("u1", async () => 1, { wiederholen: false });
    vi.spyOn(provider, "pruefeSitzung").mockResolvedValueOnce(false);
    const fn = vi.fn().mockResolvedValue("ok");
    await mitBeaSitzung("u1", fn, { wiederholen: false });
    expect(anmelden).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("wiederholen:false – Ausfall bei pruefeSitzung: kein Re-Login, fn nicht aufgerufen", async () => {
    await mitBeaSitzung("u1", async () => 1, { wiederholen: false });
    vi.spyOn(provider, "pruefeSitzung").mockRejectedValueOnce(new BeaExpertError("down", "x", 503));
    const fn = vi.fn();
    await expect(mitBeaSitzung("u1", fn, { wiederholen: false })).rejects.toBeInstanceOf(BeaExpertError);
    expect(anmelden).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("falsche PIN → Zertifikat FEHLER und BeaNichtEingerichtetError", async () => {
    vi.mocked(ladeZertifikat).mockResolvedValue({ p12: Buffer.from("p12"), pin: "falsch" });
    const fn = vi.fn();
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).rejects.toBeInstanceOf(BeaNichtEingerichtetError);
    expect(markiereZertifikatFehler).toHaveBeenCalledWith("u1", expect.stringMatching(/^beA-Anmeldung fehlgeschlagen: /));
    expect(fn).not.toHaveBeenCalled();
  });

  it("Ausfall beim Anmelden markiert das Zertifikat NICHT als FEHLER", async () => {
    anmelden.mockRejectedValueOnce(new BeaExpertError("Netzwerk", "x", null));
    await expect(mitBeaSitzung("u1", vi.fn(), { wiederholen: true })).rejects.toBeInstanceOf(BeaExpertError);
    expect(markiereZertifikatFehler).not.toHaveBeenCalled();
  });

  it("ohne Zertifikat oder ohne Provider → BeaNichtEingerichtetError", async () => {
    vi.mocked(ladeZertifikat).mockResolvedValue(null);
    await expect(mitBeaSitzung("u1", vi.fn(), { wiederholen: true })).rejects.toBeInstanceOf(BeaNichtEingerichtetError);
    vi.mocked(getBeaProvider).mockReturnValue(null);
    await expect(mitBeaSitzung("u1", vi.fn(), { wiederholen: true })).rejects.toBeInstanceOf(BeaNichtEingerichtetError);
  });
});

describe("Redis-Ausfall", () => {
  it("get wirft → es wird direkt angemeldet und fn läuft", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeRedis.get.mockRejectedValueOnce(new Error("down"));
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).resolves.toBe("ok");
    expect(anmelden).toHaveBeenCalledTimes(1);
  });

  it("set und del werfen → fn läuft trotzdem", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeRedis.set.mockRejectedValueOnce(new Error("down"));
    fakeRedis.del.mockRejectedValue(new Error("down"));
    const fn = vi.fn()
      .mockRejectedValueOnce(new BeaExpertError("x", "x", 401))
      .mockResolvedValueOnce("ok");
    await expect(mitBeaSitzung("u1", fn, { wiederholen: true })).resolves.toBe("ok");
    await expect(verwerfeBeaSitzung("u1")).resolves.toBeUndefined();
    fakeRedis.del.mockImplementation(async (k: string) => (store.delete(k) ? 1 : 0));
  });
});

describe("verwerfeBeaSitzung", () => {
  it("entfernt die Sitzung, sodass neu angemeldet wird", async () => {
    await mitBeaSitzung("u1", async () => 1, { wiederholen: true });
    await verwerfeBeaSitzung("u1");
    await mitBeaSitzung("u1", async () => 1, { wiederholen: true });
    expect(anmelden).toHaveBeenCalledTimes(2);
  });
});
