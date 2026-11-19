import { describe, it, expect } from "vitest";
import {
  pruefeZeichensatz,
  ersetzeTypografie,
  pruefeVersand,
  pruefeEebDatum,
  heuteBerlin,
  minusKalendermonate,
} from "../regeln";

const MB = 1_048_576;
const basis = {
  betreff: "Klage Müller",
  text: "Sehr geehrte Damen und Herren",
  empfaengerSafeIds: ["DE.Justiz.1"],
  eebAnfordern: false,
  anhaenge: [{ name: "Klage.pdf", groesse: 1000 }],
};
const anhaenge = (n: number, groesse = 1) => Array.from({ length: n }, (_, i) => ({ name: `A${i}.pdf`, groesse }));

describe("pruefeZeichensatz", () => {
  it("pruefeZeichensatz meldet „ an Position 0 mit codePoint U+201E und ersatz '\"'", () => {
    expect(pruefeZeichensatz("betreff", "„Klage")).toEqual([
      { feld: "betreff", zeichen: "„", codePoint: "U+201E", position: 0, ersatz: '"' },
    ]);
  });

  it("pruefeZeichensatz akzeptiert 'Müller ß € Æ ł'", () => {
    expect(pruefeZeichensatz("text", "Müller ß € Æ ł")).toEqual([]);
    // tab, newline, carriage return and no-break space are allowed too
    expect(pruefeZeichensatz("text", "a\tb\r\nc d")).toEqual([]);
  });

  it("pruefeZeichensatz meldet Emoji ohne ersatz", () => {
    const v = pruefeZeichensatz("text", "a😀b");
    expect(v).toEqual([{ feld: "text", zeichen: "😀", codePoint: "U+1F600", position: 1, ersatz: null }]);
  });

  it("Position zählt Code Points: nach einem Emoji verschiebt sich der Index nur um 1", () => {
    const v = pruefeZeichensatz("text", "😀–");
    expect(v.map((x) => x.position)).toEqual([0, 1]);
    expect(v[1]).toMatchObject({ codePoint: "U+2013", ersatz: "-" });
  });

  it("meldet Steuerzeichen und Zeichen jenseits von U+017F ohne Ersatz", () => {
    expect(pruefeZeichensatz("x", "\u0007")[0]).toMatchObject({ codePoint: "U+0007", ersatz: null });
    expect(pruefeZeichensatz("x", "ƀ")[0]).toMatchObject({ codePoint: "U+0180", ersatz: null });
  });
});

describe("ersetzeTypografie", () => {
  it("ersetzeTypografie('„Klage“ – Teil…') === '\"Klage\" - Teil...'", () => {
    expect(ersetzeTypografie("„Klage“ – Teil…")).toBe('"Klage" - Teil...');
  });

  it("ersetzt alle Zeichen der Tabelle und lässt anderes unverändert", () => {
    expect(ersetzeTypografie("”″‚‘’′— 😀")).toBe("\"\"''''- 😀");
  });
});

describe("pruefeVersand", () => {
  it("gültige Nachricht ohne Fehler, Warnungen und Verstöße", () => {
    expect(pruefeVersand(basis)).toEqual({ fehler: [], warnungen: [], verstoesse: [] });
  });

  it("Betreff und Empfänger fehlen", () => {
    const r = pruefeVersand({ ...basis, betreff: "  ", empfaengerSafeIds: [] });
    expect(r.fehler).toEqual(["Betreff fehlt", "Mindestens ein Empfänger ist erforderlich"]);
  });

  it("pruefeVersand: eEB ohne Anhang → Fehler mit genauem Text", () => {
    const r = pruefeVersand({ ...basis, eebAnfordern: true, anhaenge: [] });
    expect(r.fehler).toEqual(["Ein eEB kann nur für Nachrichten mit mindestens einem Anhang angefordert werden"]);
  });

  it("pruefeVersand: 1001 Anhänge → Fehler; 51 Anhänge → Warnung", () => {
    expect(pruefeVersand({ ...basis, anhaenge: anhaenge(1001) }).fehler).toEqual(["Höchstens 1000 Anhänge erlaubt"]);
    const r = pruefeVersand({ ...basis, anhaenge: anhaenge(51) });
    expect(r.fehler).toEqual([]);
    expect(r.warnungen).toEqual(["Mehr als 50 Anhänge"]);
    expect(pruefeVersand({ ...basis, anhaenge: anhaenge(50) }).warnungen).toEqual([]);
  });

  it("pruefeVersand: 209_715_201 Byte → Fehler; 62_914_561 Byte → Warnung", () => {
    expect(209_715_200).toBe(200 * MB);
    expect(pruefeVersand({ ...basis, anhaenge: [{ name: "a.pdf", groesse: 209_715_201 }] }).fehler).toEqual([
      "Anhänge dürfen zusammen höchstens 200 MB groß sein",
    ]);
    expect(pruefeVersand({ ...basis, anhaenge: [{ name: "a.pdf", groesse: 209_715_200 }] }).fehler).toEqual([]);
    const r = pruefeVersand({
      ...basis,
      anhaenge: [
        { name: "a.pdf", groesse: 31_457_280 },
        { name: "b.pdf", groesse: 31_457_281 },
      ],
    });
    expect(r.warnungen).toEqual(["Anhänge größer als 60 MB"]);
    expect(pruefeVersand({ ...basis, anhaenge: [{ name: "a.pdf", groesse: 60 * MB }] }).warnungen).toEqual([]);
  });

  it("prüft Betreff, Text, beide Aktenzeichen und Anhangnamen auf den Zeichensatz", () => {
    const r = pruefeVersand({
      ...basis,
      betreff: "„B",
      text: "T…",
      aktenzeichenAbsender: "1–2",
      aktenzeichenEmpfaenger: "3—4",
      anhaenge: [{ name: "ok.pdf", groesse: 1 }, { name: "Anlage’.pdf", groesse: 1 }],
    });
    expect(r.fehler).toEqual([]);
    expect(r.verstoesse.map((v) => [v.feld, v.position])).toEqual([
      ["betreff", 0],
      ["text", 1],
      ["aktenzeichenAbsender", 1],
      ["aktenzeichenEmpfaenger", 1],
      ["anhaenge.1", 6],
    ]);
  });
});

describe("heuteBerlin und eEB-Datum", () => {
  it("heuteBerlin: 2026-11-19T23:30Z → '2026-11-20'", () => {
    expect(heuteBerlin(new Date("2026-11-19T23:30:00Z"))).toBe("2026-11-20");
    expect(heuteBerlin(new Date("2026-11-19T22:30:00Z"))).toBe("2026-11-19");
    // summer time: UTC+2
    expect(heuteBerlin(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });

  it("minus zwei Kalendermonate klemmt den Tag auf das Monatsende", () => {
    expect(minusKalendermonate("2026-12-31", 2)).toBe("2026-10-31");
    expect(minusKalendermonate("2026-04-30", 2)).toBe("2026-02-28");
    expect(minusKalendermonate("2028-04-30", 2)).toBe("2028-02-29");
    expect(minusKalendermonate("2026-01-15", 2)).toBe("2025-11-15");
  });

  it("pruefeEebDatum: morgen → Zukunftsfehler; heute minus 2 Monate → ok; minus 2 Monate minus 1 Tag → Fehler", () => {
    const heute = new Date("2026-11-19T10:00:00Z");
    expect(pruefeEebDatum("2026-11-20", heute)).toBe("Das Abgabedatum darf nicht in der Zukunft liegen");
    expect(pruefeEebDatum("2026-11-19", heute)).toBeNull();
    expect(pruefeEebDatum("2026-09-19", heute)).toBeNull();
    expect(pruefeEebDatum("2026-09-18", heute)).toBe("Das Abgabedatum darf höchstens zwei Monate zurückliegen");
  });

  it("pruefeEebDatum: Grenze bei geklemmtem Monatsende", () => {
    const heute = new Date("2026-04-30T10:00:00Z");
    expect(pruefeEebDatum("2026-02-28", heute)).toBeNull();
    expect(pruefeEebDatum("2026-02-27", heute)).toBe("Das Abgabedatum darf höchstens zwei Monate zurückliegen");
  });

  it("pruefeEebDatum: ungültiges Format oder Datum", () => {
    expect(pruefeEebDatum("19.11.2026")).toBe("Ungültiges Abgabedatum");
    expect(pruefeEebDatum("2026-02-30")).toBe("Ungültiges Abgabedatum");
  });
});
