import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    beaZertifikat: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { erzeugeTestP12 } from "../expert/__tests__/fixtures";
import {
  speichereZertifikat,
  ladeZertifikat,
  markiereZertifikatFehler,
  zertifikatInfo,
} from "../zertifikat";

const mockUpsert = vi.mocked(prisma.beaZertifikat.upsert);
const mockFindUnique = vi.mocked(prisma.beaZertifikat.findUnique);
const mockUpdate = vi.mocked(prisma.beaZertifikat.update);

const PIN = "Geheim-PIN-4711";
let gueltig: ReturnType<typeof erzeugeTestP12>;
let abgelaufen: ReturnType<typeof erzeugeTestP12>;

beforeAll(() => {
  process.env.EMAIL_ENCRYPTION_KEY ??= "0".repeat(64);
  gueltig = erzeugeTestP12(PIN);
  abgelaufen = erzeugeTestP12(PIN, {
    von: new Date(Date.UTC(2020, 0, 1)),
    bis: new Date(Date.UTC(2021, 0, 1)),
  });
});

beforeEach(() => {
  vi.resetAllMocks();
  mockUpsert.mockResolvedValue({} as any);
  mockUpdate.mockResolvedValue({} as any);
});

function gespeicherterDatensatz() {
  const args = mockUpsert.mock.calls[0][0] as any;
  return { create: args.create, update: args.update, where: args.where };
}

describe("speichereZertifikat", () => {
  it("speichereZertifikat speichert p12 und PIN verschlüsselt (Klartext-PIN kommt im gespeicherten Datensatz nicht vor)", async () => {
    const info = await speichereZertifikat("user-1", gueltig.p12, PIN);

    expect(info.seriennummer).toBe("0a1b2c3d");
    expect(info.inhaber).toBe("Max Müller");
    expect(info.gueltigBis).toBeInstanceOf(Date);

    const { create, update, where } = gespeicherterDatensatz();
    expect(where).toEqual({ userId: "user-1" });
    const json = JSON.stringify({ create, update });
    expect(json).not.toContain(PIN);
    expect(json).not.toContain(gueltig.p12.toString("base64"));
    expect(create.p12Verschluesselt).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(create.pinVerschluesselt).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    // Round trip: what was stored can be loaded back
    mockFindUnique.mockResolvedValue({ ...create, status: "AKTIV" } as any);
    const geladen = await ladeZertifikat("user-1");
    expect(geladen?.pin).toBe(PIN);
    expect(geladen?.p12.equals(gueltig.p12)).toBe(true);
  });

  it("speichereZertifikat wirft bei falscher PIN 'PIN falsch oder Datei ist kein beA-Softwarezertifikat'", async () => {
    await expect(speichereZertifikat("user-1", gueltig.p12, "falsch")).rejects.toThrow(
      "PIN falsch oder Datei ist kein beA-Softwarezertifikat"
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("speichereZertifikat wirft 'Zertifikat ist abgelaufen' bei gueltigBis in der Vergangenheit", async () => {
    await expect(speichereZertifikat("user-1", abgelaufen.p12, PIN)).rejects.toThrow(
      "Zertifikat ist abgelaufen"
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("speichereZertifikat setzt einen FEHLER-Status zurück auf AKTIV", async () => {
    await speichereZertifikat("user-1", gueltig.p12, PIN);
    const { create, update } = gespeicherterDatensatz();
    for (const daten of [create, update]) {
      expect(daten.status).toBe("AKTIV");
      expect(daten.letzterFehler).toBeNull();
    }
  });
});

describe("ladeZertifikat", () => {
  it("ladeZertifikat liefert null bei Status FEHLER", async () => {
    mockFindUnique.mockResolvedValue({
      p12Verschluesselt: "x",
      pinVerschluesselt: "y",
      status: "FEHLER",
    } as any);
    expect(await ladeZertifikat("user-1")).toBeNull();
  });

  it("ladeZertifikat liefert null ohne Zertifikat", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await ladeZertifikat("user-1")).toBeNull();
  });
});

describe("markiereZertifikatFehler / zertifikatInfo", () => {
  it("markiereZertifikatFehler setzt Status FEHLER mit Meldung", async () => {
    await markiereZertifikatFehler("user-1", "PIN falsch");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { status: "FEHLER", letzterFehler: "PIN falsch" },
    });
  });

  it("zertifikatInfo gibt keine Geheimnisse heraus", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await zertifikatInfo("user-1")).toBeNull();
    const select = (mockFindUnique.mock.calls[0][0] as any).select;
    expect(select.p12Verschluesselt).toBeUndefined();
    expect(select.pinVerschluesselt).toBeUndefined();
  });
});
