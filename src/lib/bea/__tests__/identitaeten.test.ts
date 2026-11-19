import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermission, mitBeaSitzung, getBeaProvider } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  mitBeaSitzung: vi.fn(),
  getBeaProvider: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requirePermission }));
vi.mock("@/lib/bea/provider", () => ({ getBeaProvider }));
vi.mock("@/lib/bea/sitzung", async () => {
  class BeaNichtEingerichtetError extends Error {}
  return { mitBeaSitzung, BeaNichtEingerichtetError };
});

import { NextRequest, NextResponse } from "next/server";
import { BeaNichtEingerichtetError } from "@/lib/bea/sitzung";
import { GET } from "@/app/api/bea/identitaeten/route";

const treffer = [{ safeId: "DE.BRAK.1", name: "RA Müller", ort: "Köln" }];
const provider = { sucheIdentitaet: vi.fn(async () => treffer) };

function anfrage(qs: string) {
  return new NextRequest(`http://localhost/api/bea/identitaeten?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ session: { user: { id: "u1", role: "ANWALT" } } });
  getBeaProvider.mockReturnValue(provider);
  mitBeaSitzung.mockImplementation(async (_u: string, fn: (s: unknown, p: unknown) => unknown) => fn({}, provider));
});

describe("GET /api/bea/identitaeten", () => {
  it("sucht mit canReadBeA und wiederholbarer Sitzung", async () => {
    const res = await GET(anfrage("name=M%C3%BCller&plz=50667&ort=K%C3%B6ln"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ identitaeten: treffer });
    expect(requirePermission).toHaveBeenCalledWith("canReadBeA");
    expect(mitBeaSitzung).toHaveBeenCalledWith("u1", expect.any(Function), { wiederholen: true });
    expect(provider.sucheIdentitaet).toHaveBeenCalledWith({}, { name: "Müller", plz: "50667", ort: "Köln" });
  });

  it("leere Parameter werden nicht übergeben", async () => {
    await GET(anfrage("name=M%C3%BCller&plz=&ort=%20"));
    expect(provider.sucheIdentitaet).toHaveBeenCalledWith({}, { name: "Müller", plz: undefined, ort: undefined });
  });

  it("ohne Suchbegriff → 400", async () => {
    expect((await GET(anfrage(""))).status).toBe(400);
    expect(mitBeaSitzung).not.toHaveBeenCalled();
  });

  it("ohne Berechtigung → Antwort der Berechtigungsprüfung", async () => {
    requirePermission.mockResolvedValue({ error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) });
    expect((await GET(anfrage("name=x"))).status).toBe(403);
    expect(mitBeaSitzung).not.toHaveBeenCalled();
  });

  it("kein Provider → 503", async () => {
    getBeaProvider.mockReturnValue(null);
    expect((await GET(anfrage("name=x"))).status).toBe(503);
  });

  it("kein Zertifikat → 409", async () => {
    mitBeaSitzung.mockRejectedValue(new BeaNichtEingerichtetError("Kein gültiges beA-Zertifikat hinterlegt."));
    const res = await GET(anfrage("name=x"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Kein gültiges beA-Zertifikat hinterlegt.");
  });

  it("beA-Ausfall → 502", async () => {
    mitBeaSitzung.mockRejectedValue(new Error("ECONNRESET"));
    expect((await GET(anfrage("name=x"))).status).toBe(502);
  });
});
