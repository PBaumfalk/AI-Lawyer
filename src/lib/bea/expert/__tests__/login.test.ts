import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://api.bea.expert"),
}));

import { anmelden } from "../login";
import { BeaExpertError } from "../transport";
import * as krypto from "../krypto";
import { erzeugeTestP12 } from "./fixtures";

const PIN = "test-pin";
let cert: ReturnType<typeof erzeugeTestP12>;

beforeAll(() => {
  cert = erzeugeTestP12(PIN);
}, 60_000);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function oaep(data: Buffer): string {
  return crypto
    .publicEncrypt(
      { key: cert.zertifikatPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      data,
    )
    .toString("base64");
}

function bodyVon(call: unknown[]): Record<string, string> {
  const init = call[1] as { body: string };
  const j = new URLSearchParams(init.body).get("j")!;
  return JSON.parse(Buffer.from(j, "base64").toString("utf8"));
}

describe("bea.expert Login", () => {
  const fetchMock = vi.fn();
  const sessionKey = crypto.randomBytes(32);
  const validationKey = crypto.randomBytes(16);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BEA_EXPERT_IDENT", "ident-1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function simuliere(step1: Record<string, string>) {
    fetchMock
      .mockResolvedValueOnce(json(step1))
      .mockResolvedValueOnce(
        json({
          sessionKey: oaep(sessionKey),
          validationKey: oaep(validationKey),
          safeId: "DE.BRAK.test.1",
          tokenValidation: "tv-1",
        }),
      )
      .mockResolvedValueOnce(json({ token: "tok-1" }));
  }

  it("führt step1–3 aus und liefert token, sessionKey (32 Byte) und safeId", async () => {
    simuliere({
      challengeVal: crypto.randomUUID(),
      challengeValidation: crypto.randomUUID(),
      tokenPAOS: "paos-1",
    });

    const s = await anmelden(cert.p12, PIN);

    expect(s.token).toBe("tok-1");
    expect(s.safeId).toBe("DE.BRAK.test.1");
    expect(s.sessionKey.length).toBe(32);
    expect(s.sessionKey.equals(sessionKey)).toBe(true);

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.bea.expert/bex_login_step1",
      "https://api.bea.expert/bex_login_step2",
      "https://api.bea.expert/bex_login_step3",
    ]);
    const b1 = bodyVon(fetchMock.mock.calls[0]);
    expect(b1.thumbprint).toMatch(/^[0-9a-f]{40}$/);
    expect(b1).toMatchObject({ diagnose: false });
    const b2 = bodyVon(fetchMock.mock.calls[1]);
    expect(b2.tokenPAOS).toBe("paos-1");
    // PEM line endings differ between forge (CRLF) and node (LF): compare the certificate itself
    const userCertPem = Buffer.from(b2.userCert, "base64").toString("utf8");
    expect(new crypto.X509Certificate(userCertPem).raw.equals(new crypto.X509Certificate(cert.zertifikatPem).raw)).toBe(true);
    expect(b2.challengeSigned).toBeTruthy();
    expect(b2.validationSigned).toBeTruthy();
    const b3 = bodyVon(fetchMock.mock.calls[2]);
    expect(b3.tokenValidation).toBe("tv-1");
    expect(b3.validationKey).toBe(validationKey.toString("base64"));
  });

  it("dekodiert Base64-Challenges, die keine UUID sind, vor dem Signieren", async () => {
    const uuid = crypto.randomUUID();
    simuliere({
      challengeVal: Buffer.from("Herausforderung-ü-1").toString("base64"),
      challengeValidation: uuid,
      tokenPAOS: "paos-1",
    });
    const spy = vi.spyOn(krypto, "signiereChallenge");

    await anmelden(cert.p12, PIN);

    expect(spy.mock.calls[0][0]).toBe("Herausforderung-ü-1");
    expect(spy.mock.calls[1][0]).toBe(uuid);
  });

  it("wirft BeaExpertError, wenn step2 einen error liefert", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ challengeVal: crypto.randomUUID(), challengeValidation: crypto.randomUUID(), tokenPAOS: "p" }),
      )
      .mockResolvedValueOnce(json({ error: "Zertifikat abgelehnt" }));

    await expect(anmelden(cert.p12, PIN)).rejects.toBeInstanceOf(BeaExpertError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wirft bei falscher PIN, ohne das Netz zu berühren", async () => {
    await expect(anmelden(cert.p12, "falsch")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
