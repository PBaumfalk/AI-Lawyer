import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://api.bea.expert"),
}));

import { getBeaProvider, type BeaVersandAuftrag, type BeaSitzung } from "../provider";
import { BeaExpertProvider } from "../expert/provider";
import { MockProvider } from "../mock-provider";

const auftrag: BeaVersandAuftrag = {
  postfachSafeId: "DE.Justiztest.a",
  empfaengerSafeIds: ["DE.Justiztest.b"],
  betreff: "Test",
  text: "Hallo",
  nachrichtenTyp: "TESTNACHRICHT",
  eebAnfordern: false,
  dringend: false,
  anhaenge: [],
};
const sitzung: BeaSitzung = { token: "t", sessionKey: Buffer.alloc(32), safeId: "s" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBeaProvider", () => {
  it("liefert BeaExpertProvider bei gesetztem BEA_EXPERT_IDENT", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "ident");
    vi.stubEnv("NODE_ENV", "production");
    expect(getBeaProvider()).toBeInstanceOf(BeaExpertProvider);
  });

  it("liefert MockProvider ohne Ident außerhalb von Produktion", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "");
    vi.stubEnv("NODE_ENV", "development");
    const p = getBeaProvider();
    expect(p).toBeInstanceOf(MockProvider);
    expect(getBeaProvider()).toBe(p);
  });

  it("liefert null ohne Ident in Produktion", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(getBeaProvider()).toBeNull();
  });

  it("BEA_PROVIDER=mock in Produktion bleibt null", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "ident");
    vi.stubEnv("BEA_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "production");
    expect(getBeaProvider()).toBeNull();
  });

  it("BEA_PROVIDER=expert ohne Ident liefert null", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "");
    vi.stubEnv("BEA_PROVIDER", "expert");
    vi.stubEnv("NODE_ENV", "development");
    expect(getBeaProvider()).toBeNull();
  });

  it("BEA_PROVIDER=mock erzwingt Mock außerhalb von Produktion", () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "ident");
    vi.stubEnv("BEA_PROVIDER", "mock");
    vi.stubEnv("NODE_ENV", "development");
    expect(getBeaProvider()).toBeInstanceOf(MockProvider);
  });
});

describe("MockProvider", () => {
  it("sende zeichnet den Auftrag auf und liefert eine messageId", async () => {
    const m = new MockProvider();
    const r = await m.sende(sitzung, auftrag);
    expect(r.messageId).toMatch(/^mock-\d+$/);
    expect(m.gesendet).toEqual([auftrag]);
  });

  it("anmelden wirft bei PIN 'falsch'", async () => {
    const m = new MockProvider();
    await expect(m.anmelden(Buffer.from("x"), "falsch")).rejects.toThrow();
    const s = await m.anmelden(Buffer.from("x"), "richtig");
    expect(s.token).toBeTruthy();
    expect(await m.pruefeSitzung(s)).toBe(true);
  });

  it("liefert Seed-Postfächer, einen Ordner und Nachrichten", async () => {
    const msg = {
      messageId: "m1", osciMessageId: null, betreff: "B", text: null,
      absender: { safeId: "a", name: "A" }, empfaenger: [], aktenzeichenAbsender: null,
      aktenzeichenJustiz: null, empfangenAm: null, eebAngefordert: false, vertraulich: false,
      dringend: false, anhaenge: [],
    };
    const m = new MockProvider({ postfaecher: [{ safeId: "p", name: "P", typ: "x" }], nachrichten: [msg] });
    expect(await m.listePostfaecher(sitzung)).toHaveLength(1);
    const o = await m.listeOrdner(sitzung, "p");
    expect(o).toHaveLength(1);
    expect((await m.listeNachrichten(sitzung, o[0].id))[0].messageId).toBe("m1");
    expect((await m.holeNachricht(sitzung, "m1")).betreff).toBe("B");
  });
});

describe("BeaExpertProvider", () => {
  it("sucheIdentitaet mappt bea_search-Ergebnisse", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: "t", results: [
        { safeId: "S1", firstname: "Max", surname: "Müller", city: "Köln" },
        { safeId: "S2", firstname: "", surname: "Kanzlei X", city: "" },
      ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BEA_EXPERT_IDENT", "ident");
    const r = await new BeaExpertProvider().sucheIdentitaet(sitzung, { name: "Müller", ort: "Köln" });
    expect(r).toEqual([
      { safeId: "S1", name: "Max Müller", ort: "Köln" },
      { safeId: "S2", name: "Kanzlei X", ort: null },
    ]);
    vi.unstubAllGlobals();
  });

  it("pruefeSitzung ist false bei BeaExpertError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid" }), { status: 200 })));
    vi.stubEnv("BEA_EXPERT_IDENT", "ident");
    expect(await new BeaExpertProvider().pruefeSitzung(sitzung)).toBe(false);
    vi.unstubAllGlobals();
  });
});
