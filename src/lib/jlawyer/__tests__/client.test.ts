import { describe, it, expect, vi, afterEach } from "vitest";
import { JLawyerClient, parseJLawyerDate, resolveRestRoot } from "../client";
import { mapKalenderTyp } from "../etl-kalender";
import { mapBeteiligterRolle, mapKontaktTyp } from "../etl-kontakte";
import { normalizeReport } from "../migration-status";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({}));
vi.mock("@/lib/meilisearch", () => ({}));
vi.mock("@/lib/queue/queues", () => ({}));

afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("JLawyerClient – Pfade laut Endpunktkatalog", () => {
  const client = () => new JLawyerClient({ baseUrl: "https://jl.example.com:8080", username: "u", password: "p" });

  it.each([
    ["listCases", [], "/v1/cases/list"],
    ["getCase", ["abc"], "/v2/cases/abc"],
    ["getCaseParties", ["abc"], "/v1/cases/abc/parties"],
    ["getCaseDueDates", ["abc"], "/v4/cases/abc/duedates"],
    ["getCaseDocuments", ["abc"], "/v1/cases/abc/documents"],
    ["getCaseFolders", ["abc"], "/v3/cases/abc/folders"],
    ["listContacts", [], "/v1/contacts/list"],
    ["getContact", ["k1"], "/v2/contacts/k1"],
    ["listUsers", [], "/v6/security/users/list"],
  ])("%s → %s", async (method, args, path) => {
    const einzelobjekt = ["getCase", "getCaseFolders", "getContact"].includes(method);
    const fn = stubFetch(einzelobjekt ? {} : []);
    await (client() as any)[method](...args);
    expect(fn.mock.calls[0][0]).toBe(`https://jl.example.com:8080/j-lawyer-io/rest${path}`);
    expect((fn.mock.calls[0] as any)[1].headers.Authorization).toBe("Basic " + Buffer.from("u:p").toString("base64"));
  });

  it("dekodiert den Base64-Dokumentinhalt", async () => {
    const fn = stubFetch({ id: "d1", fileName: "a.pdf", base64content: Buffer.from("PDF!").toString("base64") });
    const r = await client().getDocumentContent("d1");
    expect(fn.mock.calls[0][0]).toBe("https://jl.example.com:8080/j-lawyer-io/rest/v1/cases/document/d1/content");
    expect(r.buffer.toString()).toBe("PDF!");
  });

  it("meldet eine Nicht-Liste statt still weiterzumachen", async () => {
    stubFetch({ unexpected: true });
    await expect(client().listCases()).rejects.toThrow(/Liste erwartet/);
  });

  it("IDs werden URL-kodiert", async () => {
    const fn = stubFetch({});
    await client().getCase("a/b");
    expect(fn.mock.calls[0][0]).toBe("https://jl.example.com:8080/j-lawyer-io/rest/v2/cases/a%2Fb");
  });
});

describe("resolveRestRoot", () => {
  it("hängt den Standard-REST-Root nur an, wenn die URL keinen Pfad hat", () => {
    expect(resolveRestRoot("https://h.example:8080")).toBe("https://h.example:8080/j-lawyer-io/rest");
    expect(resolveRestRoot("https://h.example:8080/")).toBe("https://h.example:8080/j-lawyer-io/rest");
    expect(resolveRestRoot("https://proxy.example/jl/j-lawyer-io/rest/")).toBe("https://proxy.example/jl/j-lawyer-io/rest");
  });
});

describe("parseJLawyerDate", () => {
  it.each([
    ["2026-09-30T10:00:00Z[UTC]", "2026-09-30T10:00:00.000Z"],
    ["2026-09-30T12:00:00+02:00[Europe/Berlin]", "2026-09-30T10:00:00.000Z"],
    [1790000000000, new Date(1790000000000).toISOString()],
    ["01.02.1980", "1980-02-01T00:00:00.000Z"],
  ])("%s", (input, iso) => {
    expect(parseJLawyerDate(input as any)?.toISOString()).toBe(iso);
  });
  it.each([null, undefined, "", "unbekannt", "31.02.1980"])("ungültig: %s → null", (v) => {
    expect(parseJLawyerDate(v as any)).toBeNull();
  });
});

describe("Zuordnungen", () => {
  it("Kalendertyp", () => {
    expect(mapKalenderTyp("Frist")).toBe("FRIST");
    expect(mapKalenderTyp("RESPITE")).toBe("FRIST");
    expect(mapKalenderTyp("Wiedervorlage")).toBe("WIEDERVORLAGE");
    expect(mapKalenderTyp("FOLLOWUP")).toBe("WIEDERVORLAGE");
    expect(mapKalenderTyp("Termin")).toBe("TERMIN");
    expect(mapKalenderTyp("EVENT")).toBe("TERMIN");
    expect(mapKalenderTyp("???")).toBeNull();
  });
  it("Beteiligtenrolle", () => {
    expect(mapBeteiligterRolle("Mandant")).toBe("MANDANT");
    expect(mapBeteiligterRolle("Gegner")).toBe("GEGNER");
    expect(mapBeteiligterRolle("Rechtsanwalt Gegner")).toBe("GEGNERVERTRETER");
    expect(mapBeteiligterRolle("Gericht")).toBe("GERICHT");
    expect(mapBeteiligterRolle("Dritte")).toBe("SONSTIGER");
    expect(mapBeteiligterRolle(null)).toBe("SONSTIGER");
  });
  it("Kontakttyp", () => {
    expect(mapKontaktTyp({ company: "Acme", name: "", firstName: "" })).toBe("JURISTISCH");
    expect(mapKontaktTyp({ company: "Acme", name: "Meier", firstName: "" })).toBe("NATUERLICH");
  });
});

describe("normalizeReport", () => {
  it("macht aus Altberichten und kaputtem JSON vollständige Berichte", () => {
    expect(normalizeReport(JSON.stringify({ error: "x" }))?.errors).toEqual([{ entity: "Migration", id: "-", message: "x" }]);
    expect(normalizeReport("{kaputt")?.errors).toHaveLength(1);
    expect(normalizeReport(JSON.stringify({ akten: 3 }))).toMatchObject({ akten: 3, errors: [], hinweise: [] });
    expect(normalizeReport(null)).toBeNull();
  });
});
