import { describe, it, expect, vi } from "vitest";
vi.mock("meilisearch", () => ({ MeiliSearch: class { index() { return {}; } } }));
import { buildDokumentFilter, meiliString } from "@/lib/meilisearch";

describe("Meilisearch-Filter", () => {
  it("maskiert Anführungszeichen und Backslashes", () => {
    expect(meiliString('a"b')).toBe('"a\\"b"');
    expect(meiliString("a\\b")).toBe('"a\\\\b"');
  });

  it("lässt sich nicht per Parameter umschreiben", () => {
    const evil = 'x" OR akteId != "y';
    const [f] = buildDokumentFilter({ akteId: evil });
    // the whole input stays inside one quoted literal
    expect(f).toBe('akteId = "x\\" OR akteId != \\"y"');
  });

  it("baut den Zugriffsfilter aus erlaubten Akten", () => {
    expect(buildDokumentFilter({ akteIds: ["a", "b"] })).toEqual(['akteId IN ["a", "b"]']);
  });

  it("ignoriert ungültige Zeitstempel statt NaN zu senden", () => {
    expect(buildDokumentFilter({ dateFrom: NaN, dateTo: Infinity })).toEqual([]);
    expect(buildDokumentFilter({ dateFrom: 10.7 })).toEqual(["createdAt >= 10"]);
  });
});
