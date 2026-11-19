import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeRedis = {
  get: vi.fn(), incr: vi.fn(), expire: vi.fn(), del: vi.fn(),
  sadd: vi.fn(), srem: vi.fn(), scard: vi.fn(), scan: vi.fn(),
};
vi.mock("@/lib/redis", () => ({ createRedisConnection: () => fakeRedis }));

import {
  merkeUebersprungen, vergesseUebersprungen, anzahlUebersprungen, setzePostfachFehlversucheZurueck,
} from "../fehlversuche";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("übersprungene Nachrichten", () => {
  it("merkeUebersprungen legt die messageId im Postfach-Set ab und erneuert die TTL (7 Tage)", async () => {
    await merkeUebersprungen("DE.BRAK.x", "m1");
    expect(fakeRedis.sadd).toHaveBeenCalledWith("bea:uebersprungen:DE.BRAK.x", "m1");
    expect(fakeRedis.expire).toHaveBeenCalledWith("bea:uebersprungen:DE.BRAK.x", 7 * 24 * 60 * 60);
  });

  it("Redis-Fehler beim Merken, Entfernen und Zählen → nur Warnung", async () => {
    fakeRedis.sadd.mockRejectedValue(new Error("down"));
    fakeRedis.srem.mockRejectedValue(new Error("down"));
    fakeRedis.scard.mockRejectedValue(new Error("down"));
    await expect(merkeUebersprungen("p", "m1")).resolves.toBeUndefined();
    await expect(vergesseUebersprungen("p", "m1")).resolves.toBeUndefined();
    await expect(anzahlUebersprungen("p")).resolves.toBe(0);
    expect(console.warn).toHaveBeenCalledTimes(3);
  });

  it("setzePostfachFehlversucheZurueck löscht alle Zähler des Postfachs (Glob-Zeichen maskiert) und das Set", async () => {
    fakeRedis.scard.mockResolvedValue(2);
    fakeRedis.scan
      .mockResolvedValueOnce(["7", ["bea:fehlversuch:DE.a*b:m1"]])
      .mockResolvedValueOnce(["0", ["bea:fehlversuch:DE.a*b:m2"]]);
    await expect(setzePostfachFehlversucheZurueck("DE.a*b")).resolves.toBe(2);
    expect(fakeRedis.scan).toHaveBeenNthCalledWith(1, "0", "MATCH", "bea:fehlversuch:DE.a\\*b:*", "COUNT", 200);
    expect(fakeRedis.scan).toHaveBeenNthCalledWith(2, "7", "MATCH", "bea:fehlversuch:DE.a\\*b:*", "COUNT", 200);
    expect(fakeRedis.del).toHaveBeenCalledWith("bea:fehlversuch:DE.a*b:m1");
    expect(fakeRedis.del).toHaveBeenCalledWith("bea:fehlversuch:DE.a*b:m2");
    expect(fakeRedis.del).toHaveBeenCalledWith("bea:uebersprungen:DE.a*b");
  });

  it("setzePostfachFehlversucheZurueck reicht Redis-Fehler durch", async () => {
    fakeRedis.scard.mockRejectedValue(new Error("down"));
    await expect(setzePostfachFehlversucheZurueck("p")).rejects.toThrow("down");
  });
});
