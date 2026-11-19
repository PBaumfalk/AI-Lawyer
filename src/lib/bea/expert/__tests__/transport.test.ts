import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://api.bea.expert/"),
}));

import { bexAufruf, BeaExpertError, getBeaExpertKonfig } from "../transport";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("bea.expert transport", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BEA_EXPERT_IDENT", "ident-1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sendet POST an <apiUrl>/<funktion> mit form-urlencoded j=base64(utf8-json) und bex-ident", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await bexAufruf("bea_get_postboxes", { betreff: "Müller ß €" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.bea.expert/bea_get_postboxes");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(init.headers["bex-ident"]).toBe("ident-1");
    const j = new URLSearchParams(init.body as string).get("j")!;
    const json = Buffer.from(j, "base64").toString("utf8");
    expect(json).toContain("Müller ß €");
    expect(JSON.parse(json)).toEqual({ betreff: "Müller ß €" });
  });

  it("liefert geparstes JSON zurück", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: 1, b: [2] }));
    await expect(bexAufruf("x", {})).resolves.toEqual({ a: 1, b: [2] });
  });

  it("wirft BeaExpertError bei HTTP 500 mit status 500", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "boom" }, 500));
    const err = await bexAufruf("x", {}).catch((e) => e as BeaExpertError);
    expect(err).toBeInstanceOf(BeaExpertError);
    expect(err.status).toBe(500);
    expect(err.funktion).toBe("x");
  });

  it("wirft BeaExpertError, wenn die Antwort ein nicht-leeres Feld error hat", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid token" }));
    const err = await bexAufruf("x", {}).catch((e) => e as BeaExpertError);
    expect(err).toBeInstanceOf(BeaExpertError);
    expect(err.message).toContain("invalid token");
    expect(err.antwort).toEqual({ error: "invalid token" });
  });

  it("akzeptiert ein leeres error-Feld", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "", data: 1 }));
    await expect(bexAufruf("x", {})).resolves.toEqual({ error: "", data: 1 });
  });

  it("wirft BeaExpertError, wenn BEA_EXPERT_IDENT fehlt", async () => {
    vi.stubEnv("BEA_EXPERT_IDENT", "");
    await expect(getBeaExpertKonfig()).rejects.toBeInstanceOf(BeaExpertError);
    await expect(bexAufruf("x", {})).rejects.toBeInstanceOf(BeaExpertError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bricht nach timeoutMs ab", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) => {
          init.signal.addEventListener("abort", () => rej(init.signal.reason));
        }),
    );
    const err = await bexAufruf("x", {}, { timeoutMs: 20 }).catch((e) => e as BeaExpertError);
    expect(err).toBeInstanceOf(BeaExpertError);
    expect(err.status).toBeNull();
    expect(err.message).toContain("Zeitüberschreitung");
  });
});
