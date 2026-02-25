import { describe, it, expect } from "vitest";
import { parseXJustiz } from "../parser";

// ─── Sample XJustiz XML Strings ──────────────────────────────────────────────

const XJUSTIZ_341_GRUNDDATEN = `<?xml version="1.0" encoding="UTF-8"?>
<tns:nachricht xmlns:tns="http://www.xjustiz.de/xjustiz/rs/nachricht/3/4"
               xmlns:xjustiz="http://www.xjustiz.de/xjustiz/rs/grunddaten/3/4"
               version="3.4.1">
  <tns:nachrichtenKopf version="3.4.1">
    <xjustiz:aktenzeichen>
      <xjustiz:aktenzeichenFreitext>1 O 123/25</xjustiz:aktenzeichenFreitext>
    </xjustiz:aktenzeichen>
  </tns:nachrichtenKopf>
  <tns:grunddaten>
    <xjustiz:aktenzeichen>
      <xjustiz:aktenzeichenFreitext>1 O 123/25</xjustiz:aktenzeichenFreitext>
    </xjustiz:aktenzeichen>
    <xjustiz:verfahrensgegenstand>Kaufpreiszahlung</xjustiz:verfahrensgegenstand>
    <xjustiz:gericht>
      <xjustiz:bezeichnung>Landgericht Berlin</xjustiz:bezeichnung>
    </xjustiz:gericht>
    <xjustiz:eingangsdatum>2025-01-15</xjustiz:eingangsdatum>
  </tns:grunddaten>
</tns:nachricht>`;

const XJUSTIZ_351_BETEILIGTE = `<?xml version="1.0" encoding="UTF-8"?>
<nachricht version="3.5.1">
  <beteiligung>
    <rollenbezeichnung>
      <rollenbezeichnung>Klaeger</rollenbezeichnung>
    </rollenbezeichnung>
    <natuerlichePerson>
      <vollerName>
        <vorname>Hans</vorname>
        <nachname>Mueller</nachname>
      </vollerName>
    </natuerlichePerson>
    <anschrift>
      <strasse>Hauptstrasse</strasse>
      <hausnummer>42</hausnummer>
      <postleitzahl>10115</postleitzahl>
      <ort>Berlin</ort>
    </anschrift>
  </beteiligung>
  <beteiligung>
    <rollenbezeichnung>
      <rollenbezeichnung>Beklagter</rollenbezeichnung>
    </rollenbezeichnung>
    <organisation>
      <bezeichnung>Schmidt GmbH</bezeichnung>
    </organisation>
    <kommunikation>
      <safeId>DE.BRAK.abc123456</safeId>
    </kommunikation>
  </beteiligung>
</nachricht>`;

const XJUSTIZ_INSTANZEN = `<?xml version="1.0" encoding="UTF-8"?>
<nachricht>
  <instanzdaten>
    <gericht>
      <bezeichnung>Amtsgericht Charlottenburg</bezeichnung>
    </gericht>
    <aktenzeichen>
      <aktenzeichenFreitext>3 C 456/24</aktenzeichenFreitext>
    </aktenzeichen>
    <eingangsdatum>2024-06-01</eingangsdatum>
    <abschlussdatum>2024-12-15</abschlussdatum>
  </instanzdaten>
  <instanzdaten>
    <gericht>
      <bezeichnung>Landgericht Berlin</bezeichnung>
    </gericht>
    <aktenzeichen>
      <aktenzeichenFreitext>12 S 789/25</aktenzeichenFreitext>
    </aktenzeichen>
    <eingangsdatum>2025-01-10</eingangsdatum>
  </instanzdaten>
</nachricht>`;

const XJUSTIZ_TERMINE = `<?xml version="1.0" encoding="UTF-8"?>
<nachricht>
  <terminsdaten>
    <termin>
      <terminart>Muendliche Verhandlung</terminart>
      <termindatum>2025-03-15</termindatum>
      <terminort>Saal 201</terminort>
      <bemerkung>Erscheinen aller Parteien erforderlich</bemerkung>
    </termin>
    <termin>
      <terminart>Verkuendungstermin</terminart>
      <termindatum>2025-04-01</termindatum>
    </termin>
  </terminsdaten>
</nachricht>`;

const XJUSTIZ_COMPLETE = `<?xml version="1.0" encoding="UTF-8"?>
<nachricht version="3.5.1">
  <grunddaten>
    <aktenzeichen>2 O 567/25</aktenzeichen>
    <verfahrensgegenstand>Schadensersatz</verfahrensgegenstand>
    <gericht>Landgericht Hamburg</gericht>
  </grunddaten>
  <beteiligung>
    <rolle>Klaeger</rolle>
    <natuerlichePerson>
      <vorname>Anna</vorname>
      <nachname>Becker</nachname>
    </natuerlichePerson>
  </beteiligung>
  <beteiligung>
    <rolle>Beklagter</rolle>
    <organisation>
      <bezeichnung>Versicherung AG</bezeichnung>
    </organisation>
  </beteiligung>
  <instanzdaten>
    <gericht>Landgericht Hamburg</gericht>
    <aktenzeichen>2 O 567/25</aktenzeichen>
    <eingangsdatum>2025-02-01</eingangsdatum>
  </instanzdaten>
  <terminsdaten>
    <termin>
      <terminart>Guetetermin</terminart>
      <termindatum>2025-05-20</termindatum>
      <terminort>Sitzungssaal 3</terminort>
    </termin>
  </terminsdaten>
</nachricht>`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("parseXJustiz", () => {
  describe("v3.4.1 Grunddaten extraction", () => {
    it("should extract Aktenzeichen from nested aktenzeichenFreitext", () => {
      const result = parseXJustiz(XJUSTIZ_341_GRUNDDATEN);
      expect(result.grunddaten).toBeDefined();
      expect(result.grunddaten?.aktenzeichen).toBe("1 O 123/25");
    });

    it("should extract Verfahrensgegenstand", () => {
      const result = parseXJustiz(XJUSTIZ_341_GRUNDDATEN);
      expect(result.grunddaten?.verfahrensgegenstand).toBe("Kaufpreiszahlung");
    });

    it("should extract Gericht from nested bezeichnung", () => {
      const result = parseXJustiz(XJUSTIZ_341_GRUNDDATEN);
      expect(result.grunddaten?.gericht).toBe("Landgericht Berlin");
    });

    it("should extract Eingangsdatum", () => {
      const result = parseXJustiz(XJUSTIZ_341_GRUNDDATEN);
      expect(result.grunddaten?.eingangsdatum).toBe("2025-01-15");
    });
  });

  describe("v3.5.1 Beteiligte extraction", () => {
    it("should extract all Beteiligte", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte).toHaveLength(2);
    });

    it("should extract natural person name", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte[0].name).toBe("Hans Mueller");
    });

    it("should extract organization name", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte[1].name).toBe("Schmidt GmbH");
    });

    it("should extract role (Klaeger, Beklagter)", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte[0].rolle).toBe("Klaeger");
      expect(result.beteiligte[1].rolle).toBe("Beklagter");
    });

    it("should extract address", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte[0].anschrift).toBe("Hauptstrasse 42, 10115 Berlin");
    });

    it("should extract SAFE-ID", () => {
      const result = parseXJustiz(XJUSTIZ_351_BETEILIGTE);
      expect(result.beteiligte[1].safeId).toBe("DE.BRAK.abc123456");
    });
  });

  describe("Instanzen extraction", () => {
    it("should extract all Instanzen", () => {
      const result = parseXJustiz(XJUSTIZ_INSTANZEN);
      expect(result.instanzen).toHaveLength(2);
    });

    it("should extract court name from nested bezeichnung", () => {
      const result = parseXJustiz(XJUSTIZ_INSTANZEN);
      expect(result.instanzen[0].gericht).toBe("Amtsgericht Charlottenburg");
      expect(result.instanzen[1].gericht).toBe("Landgericht Berlin");
    });

    it("should extract Aktenzeichen from aktenzeichenFreitext", () => {
      const result = parseXJustiz(XJUSTIZ_INSTANZEN);
      expect(result.instanzen[0].aktenzeichen).toBe("3 C 456/24");
      expect(result.instanzen[1].aktenzeichen).toBe("12 S 789/25");
    });

    it("should extract begin and end dates", () => {
      const result = parseXJustiz(XJUSTIZ_INSTANZEN);
      expect(result.instanzen[0].beginn).toBe("2024-06-01");
      expect(result.instanzen[0].ende).toBe("2024-12-15");
      expect(result.instanzen[1].beginn).toBe("2025-01-10");
      expect(result.instanzen[1].ende).toBeUndefined();
    });
  });

  describe("Termine extraction", () => {
    it("should extract all Termine", () => {
      const result = parseXJustiz(XJUSTIZ_TERMINE);
      expect(result.termine).toHaveLength(2);
    });

    it("should extract Terminart", () => {
      const result = parseXJustiz(XJUSTIZ_TERMINE);
      expect(result.termine[0].art).toBe("Muendliche Verhandlung");
      expect(result.termine[1].art).toBe("Verkuendungstermin");
    });

    it("should extract Termindatum", () => {
      const result = parseXJustiz(XJUSTIZ_TERMINE);
      expect(result.termine[0].datum).toBe("2025-03-15");
      expect(result.termine[1].datum).toBe("2025-04-01");
    });

    it("should extract Terminort and Bemerkung when available", () => {
      const result = parseXJustiz(XJUSTIZ_TERMINE);
      expect(result.termine[0].ort).toBe("Saal 201");
      expect(result.termine[0].bemerkung).toBe("Erscheinen aller Parteien erforderlich");
      expect(result.termine[1].ort).toBeUndefined();
    });
  });

  describe("Complete document parsing", () => {
    it("should parse a complete XJustiz document with all sections", () => {
      const result = parseXJustiz(XJUSTIZ_COMPLETE);

      expect(result.version).toBe("3.5.1");
      expect(result.grunddaten?.aktenzeichen).toBe("2 O 567/25");
      expect(result.grunddaten?.verfahrensgegenstand).toBe("Schadensersatz");
      expect(result.grunddaten?.gericht).toBe("Landgericht Hamburg");
      expect(result.beteiligte).toHaveLength(2);
      expect(result.beteiligte[0].name).toBe("Anna Becker");
      expect(result.beteiligte[1].name).toBe("Versicherung AG");
      expect(result.instanzen).toHaveLength(1);
      expect(result.instanzen[0].gericht).toBe("Landgericht Hamburg");
      expect(result.termine).toHaveLength(1);
      expect(result.termine[0].art).toBe("Guetetermin");
    });
  });

  describe("Error handling", () => {
    it("should return empty result for null input", () => {
      const result = parseXJustiz(null as any);
      expect(result.beteiligte).toEqual([]);
      expect(result.instanzen).toEqual([]);
      expect(result.termine).toEqual([]);
      expect(result.version).toBe("unknown");
    });

    it("should return empty result for empty string", () => {
      const result = parseXJustiz("");
      expect(result.beteiligte).toEqual([]);
      expect(result.instanzen).toEqual([]);
      expect(result.termine).toEqual([]);
    });

    it("should return empty result for malformed XML", () => {
      const result = parseXJustiz("<broken><xml>");
      expect(result.beteiligte).toEqual([]);
      expect(result.instanzen).toEqual([]);
      expect(result.termine).toEqual([]);
    });

    it("should return empty result for non-XML string", () => {
      const result = parseXJustiz("This is not XML at all");
      expect(result.beteiligte).toEqual([]);
      expect(result.instanzen).toEqual([]);
      expect(result.termine).toEqual([]);
    });

    it("should handle XML with unknown elements gracefully", () => {
      const xml = `<?xml version="1.0"?>
        <nachricht>
          <unknownElement>some data</unknownElement>
          <grunddaten>
            <aktenzeichen>99/25</aktenzeichen>
          </grunddaten>
          <anotherUnknown attr="val">test</anotherUnknown>
        </nachricht>`;
      const result = parseXJustiz(xml);
      expect(result.grunddaten?.aktenzeichen).toBe("99/25");
      expect(result.beteiligte).toEqual([]);
    });
  });

  describe("Namespace stripping", () => {
    it("should strip XJustiz namespaces correctly", () => {
      const xml = `<?xml version="1.0"?>
        <xjustiz_0005:nachricht xmlns:xjustiz_0005="http://www.xjustiz.de/xjustiz/rs/nachricht/3/5">
          <xjustiz_0005:grunddaten>
            <xjustiz_0005:aktenzeichen>5 O 999/25</xjustiz_0005:aktenzeichen>
            <xjustiz_0005:gericht>Amtsgericht Muenchen</xjustiz_0005:gericht>
          </xjustiz_0005:grunddaten>
        </xjustiz_0005:nachricht>`;
      const result = parseXJustiz(xml);
      expect(result.grunddaten?.aktenzeichen).toBe("5 O 999/25");
      expect(result.grunddaten?.gericht).toBe("Amtsgericht Muenchen");
    });
  });
});
