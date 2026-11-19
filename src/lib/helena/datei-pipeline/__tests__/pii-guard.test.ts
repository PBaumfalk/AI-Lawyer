import { describe, it, expect } from "vitest";
import { PiiGuard, maskiere } from "../pii-guard";
import { lokaleRueckfuehrung, bereinigeOriginal } from "../rueckfuehrung";
import { teileText, wartezeit } from "../anymize-client";

const paare = [
  { original: "Sabine Krüger-Wendt", placeholder: "[[Person-AAAAAA]]", prefix_name: "Person" },
  { original: "DE89 3704 0044 0532 0130 00", placeholder: "[[IBAN-BBBBBB]]" },
];

describe("PiiGuard", () => {
  const g = new PiiGuard({ originalText: "Mail: s.k@beispiel.de, Tel. 0221 4789123, geb. 14.07.1983, Steuer-ID: 47 036 892 815", paare, erlaubteWerte: ["Appellhofplatz 1", "50667 Köln"] });

  it("lässt reinen Platzhaltertext durch", () => {
    expect(g.pruefeSync("Frau [[Person-AAAAAA]] zahlt auf [[IBAN-BBBBBB]] am 01.04.2026, Az. 2 Ca 1234/26.")).toEqual([]);
  });
  it("findet Namensteile mit Genitiv", () => {
    expect(g.pruefeSync("Laut Krüger-Wendts Angaben")).not.toEqual([]);
    expect(g.pruefeSync("Sabine kam")).toHaveLength(1);
    expect(g.pruefeSync("geb. [[Datum-CCCCCC]], Steuer-ID: [[ID-DDDDDD]]")).toEqual([]);
  });
  it("ist robust gegen Umbrüche, weiche Trennzeichen und Nullbreite-Zeichen", () => {
    expect(g.pruefeSync("Krü­ger-Wendt")).not.toEqual([]);
    expect(g.pruefeSync("Kr​üger-Wendt")).not.toEqual([]);
    expect(g.pruefeSync("Sabine\nKrüger-Wendt")).not.toEqual([]);
  });
  it("findet Ziffernfolgen auch anders formatiert", () => {
    expect(g.pruefeSync("Konto DE8937040044 05320130 00")).not.toEqual([]);
    expect(g.pruefeSync("Ruf an: 0221/478 9123")).not.toEqual([]);
  });
  it("Datumsangaben und Aktenzeichen sind keine Telefonnummern", () => {
    expect(g.pruefeSync("Frist bis 08.12.2026, Az. 12 O 345/26, Betrag 3.850,00 EUR, § 4 KSchG")).toEqual([]);
  });
  it("erlaubte Werte (Gerichtsadresse) blockieren nicht", () => {
    expect(g.pruefeSync("Landgericht Köln, Appellhofplatz 1, 50667 Köln")).toEqual([]);
  });
  it("Originalwert mit maskiertem Zeilenumbruch wird in Namensteile zerlegt", () => {
    const g2 = new PiiGuard({ originalText: "", paare: [{ original: "Rheinland Logistik\\nHoffmann GmbH", placeholder: "[[company_name-X]]", prefix_name: "company_name" }] });
    expect(g2.pruefeSync("Die Firma Hoffmann kündigte.")).not.toEqual([]);
  });
  it("Funde enthalten nur Masken, nie den Wert", () => {
    const f = g.pruefeSync("Sabine Krüger-Wendt");
    expect(JSON.stringify(f)).not.toContain("Krüger");
    expect(maskiere("Krüger")).toBe("K***r (6 Zeichen)");
  });
});

describe("Rückführung und Hilfsfunktionen", () => {
  it("ersetzt exakte und verstümmelte Platzhalter", () => {
    const r = lokaleRueckfuehrung("[[Person-AAAAAA]], [Person-AAAAAA], person-aaaaaa, [[Unbekannt-ZZZZZZ]]", paare);
    expect(r.text).toBe("Sabine Krüger-Wendt, Sabine Krüger-Wendt, Sabine Krüger-Wendt, [[Unbekannt-ZZZZZZ]]");
    expect(r.offen).toBe(1);
  });
  it("maskierte und echte Zeilenumbrüche im Originalwert werden zu Leerzeichen (live beobachtet)", () => {
    expect(bereinigeOriginal("Rheinland Logistik\\nHoffmann GmbH")).toBe("Rheinland Logistik Hoffmann GmbH");
    expect(bereinigeOriginal("DE89 3704 0044\n0532 0130 00")).toBe("DE89 3704 0044 0532 0130 00");
    const r = lokaleRueckfuehrung("bei der [[company_name-FB7DOL]] seit", [{ original: "Rheinland Logistik\\nHoffmann GmbH", placeholder: "[[company_name-FB7DOL]]" }]);
    expect(r.text).toBe("bei der Rheinland Logistik Hoffmann GmbH seit");
  });
  it("teilt lange Texte nie mitten im Wort", () => {
    const text = "Wort ".repeat(50) + "Krüger-Wendt " + "Wort ".repeat(50);
    const teile = teileText(text, 64);
    expect(teile.join("")).toBe(text);
    expect(teile.some((t) => t.includes("Krüger-Wendt"))).toBe(true);
  });
  it("Retry-After als Sekunden und als Unix-Zeit", () => {
    expect(wartezeit("5", 1)).toBe(5000);
    expect(wartezeit(String(Math.floor(Date.now() / 1000) + 10), 1)).toBeGreaterThan(8000);
    expect(wartezeit(null, 2)).toBe(4000);
  });
});
