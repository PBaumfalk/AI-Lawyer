/**
 * Goldset test catalog for Helena QA (QA-01, QA-02).
 *
 * Fixed set of >=20 Arbeitsrecht queries with expected retrieval results.
 * Used for reproducible quality measurement of the RAG pipeline.
 *
 * Categories covered: KSchG Kuendigung, Lohnklage, Abmahnung,
 * einstweilige Verfuegung, Mahnverfahren, Fristen, Kosten,
 * Aufhebungsvertrag, Kuendigungsschutzklage, Betriebsrat,
 * Zeugnis, Befristung, Diskriminierung
 */

export interface GoldsetQuery {
  /** Unique identifier (e.g., "kschg-01") */
  id: string;
  /** German description of the scenario */
  description: string;
  /** The user query / Schriftsatz prompt */
  query: string;
  /** Expected legal provisions (e.g., ["KSchG SS 1", "KSchG SS 4", "BGB SS 622"]) */
  expectedNormen: string[];
  /** Expected rulings (e.g., ["BAG Az. 2 AZR 123/22"]) */
  expectedUrteile: string[];
  /** Expected Schriftsatz sections (e.g., ["Rubrum", "Antraege", "Sachverhalt"]) */
  expectedSections: string[];
  /** Category (e.g., "Kuendigung", "Lohnklage", "Fristen") */
  schwerpunkt: string;
}

export const GOLDSET_QUERIES: GoldsetQuery[] = [
  // --- Kuendigungsschutz (KSchG) ---
  {
    id: "kschg-01",
    description: "Ordentliche Kuendigung Arbeitgeber wegen Krankheit",
    query:
      "Erstelle eine Kuendigungsschutzklage gegen eine krankheitsbedingte Kuendigung. Mandant arbeitet seit 8 Jahren, Betrieb hat 200 Mitarbeiter.",
    expectedNormen: ["KSchG SS 1", "KSchG SS 4", "KSchG SS 23"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Kuendigung",
  },
  {
    id: "kschg-02",
    description: "Fristlose Kuendigung Arbeitnehmer wegen Diebstahl",
    query:
      "Kuendigungsschutzklage gegen fristlose Kuendigung wegen angeblichem Diebstahl (Pfandbon, Wert 1.30 EUR). Betriebszugehoerigkeit 20 Jahre.",
    expectedNormen: ["BGB SS 626", "KSchG SS 1", "KSchG SS 13"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Kuendigung",
  },
  {
    id: "kschg-03",
    description: "Betriebsbedingte Kuendigung bei Sozialauswahl",
    query:
      "Kuendigungsschutzklage wegen betriebsbedingter Kuendigung. Mandant meint die Sozialauswahl war fehlerhaft.",
    expectedNormen: ["KSchG SS 1", "KSchG SS 1 Abs. 3", "KSchG SS 4"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Kuendigung",
  },
  {
    id: "kschg-04",
    description: "Aenderungskuendigung",
    query:
      "Klage gegen eine Aenderungskuendigung, Mandant soll unter schlechteren Bedingungen weiterarbeiten.",
    expectedNormen: ["KSchG SS 2", "KSchG SS 4", "BGB SS 622"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Kuendigung",
  },
  // --- Lohn / Gehalt ---
  {
    id: "lohn-01",
    description: "Lohnklage wegen Zahlungsverzug",
    query:
      "Klage auf ausstehende Lohnzahlung fuer 3 Monate. Arbeitgeber zahlt nicht trotz Mahnung.",
    expectedNormen: ["BGB SS 611a", "BGB SS 614", "BGB SS 286"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt", "Kosten"],
    schwerpunkt: "Lohnklage",
  },
  {
    id: "lohn-02",
    description: "Ueberstundenverguetung",
    query:
      "Klage auf Verguetung von 200 Ueberstunden. Arbeitsvertrag regelt keine Ueberstundenpauschale.",
    expectedNormen: ["BGB SS 611a", "BGB SS 612", "ArbZG SS 3"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Lohnklage",
  },
  // --- Abmahnung ---
  {
    id: "abm-01",
    description: "Klage auf Entfernung einer Abmahnung",
    query:
      "Mandant moechte Abmahnung wegen angeblich ungerechtfertigtem Zuspaetkommen aus der Personalakte entfernen lassen.",
    expectedNormen: ["BGB SS 1004", "BGB SS 241 Abs. 2"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Abmahnung",
  },
  {
    id: "abm-02",
    description: "Wirksamkeit einer Abmahnung pruefen",
    query:
      "Pruefe ob die Abmahnung formell und inhaltlich wirksam ist. Arbeitgeber hat nur muendlich abgemahnt.",
    expectedNormen: ["BGB SS 314 Abs. 2", "BGB SS 626"],
    expectedUrteile: [],
    expectedSections: ["Sachverhalt", "Rechtliche Wuerdigung"],
    schwerpunkt: "Abmahnung",
  },
  // --- Einstweilige Verfuegung ---
  {
    id: "ev-01",
    description: "Einstweilige Verfuegung gegen Freistellung",
    query:
      "Antrag auf einstweilige Verfuegung. Mandant wurde nach Kuendigung sofort freigestellt, will Weiterbeschaeftigung.",
    expectedNormen: ["ZPO SS 935", "ZPO SS 940", "BGB SS 611a"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Einstweilige Verfuegung",
  },
  {
    id: "ev-02",
    description: "Einstweilige Verfuegung Zeugnis",
    query:
      "Eilantrag auf Erteilung eines Zwischenzeugnisses. Mandant braucht es dringend fuer Bewerbung.",
    expectedNormen: ["GewO SS 109", "ZPO SS 935", "ZPO SS 940"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Einstweilige Verfuegung",
  },
  // --- Mahnverfahren ---
  {
    id: "mahn-01",
    description: "Mahnbescheid wegen ausstehender Abfindung",
    query:
      "Mahnbescheid beantragen. Abfindung aus Aufhebungsvertrag wurde nicht gezahlt (15.000 EUR).",
    expectedNormen: ["ZPO SS 688", "ZPO SS 689", "BGB SS 286"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege"],
    schwerpunkt: "Mahnverfahren",
  },
  // --- Fristen ---
  {
    id: "frist-01",
    description: "3-Wochen-Frist Kuendigungsschutzklage",
    query:
      "Mandant hat Kuendigung vor 2 Wochen erhalten. Wie berechnet sich die Klagefrist nach KSchG SS 4?",
    expectedNormen: ["KSchG SS 4", "KSchG SS 5", "ZPO SS 222"],
    expectedUrteile: [],
    expectedSections: [],
    schwerpunkt: "Fristen",
  },
  {
    id: "frist-02",
    description: "Kuendigungsfrist bei langer Betriebszugehoerigkeit",
    query:
      "Welche Kuendigungsfristen gelten bei 15 Jahren Betriebszugehoerigkeit?",
    expectedNormen: ["BGB SS 622"],
    expectedUrteile: [],
    expectedSections: [],
    schwerpunkt: "Fristen",
  },
  // --- Kosten ---
  {
    id: "kosten-01",
    description: "Gerichtskosten Kuendigungsschutzklage berechnen",
    query:
      "Berechne die Gerichts- und Anwaltskosten fuer eine Kuendigungsschutzklage bei einem Bruttomonatsgehalt von 4.500 EUR.",
    expectedNormen: ["GKG Anlage 2", "RVG SS 2"],
    expectedUrteile: [],
    expectedSections: ["Kosten"],
    schwerpunkt: "Kosten",
  },
  // --- Aufhebungsvertrag ---
  {
    id: "aufh-01",
    description: "Aufhebungsvertrag pruefen",
    query:
      "Mandant wurde Aufhebungsvertrag mit Abfindung angeboten. Pruefen ob die Konditionen angemessen sind.",
    expectedNormen: ["BGB SS 311 Abs. 1", "BGB SS 623", "SGB III SS 159"],
    expectedUrteile: [],
    expectedSections: ["Sachverhalt", "Rechtliche Wuerdigung"],
    schwerpunkt: "Aufhebungsvertrag",
  },
  {
    id: "aufh-02",
    description: "Anfechtung Aufhebungsvertrag wegen Drohung",
    query:
      "Mandant hat Aufhebungsvertrag unter Druck unterschrieben. Arbeitgeber drohte mit fristloser Kuendigung.",
    expectedNormen: ["BGB SS 123", "BGB SS 142", "BGB SS 119"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Aufhebungsvertrag",
  },
  // --- Betriebsrat ---
  {
    id: "br-01",
    description: "Kuendigung ohne Betriebsratsanhoerung",
    query:
      "Kuendigungsschutzklage. Betriebsrat wurde vor der Kuendigung nicht angehoert.",
    expectedNormen: ["BetrVG SS 102", "KSchG SS 1"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Betriebsrat",
  },
  // --- Zeugnis ---
  {
    id: "zeugnis-01",
    description: "Klage auf qualifiziertes Arbeitszeugnis",
    query:
      "Klage auf Erteilung eines qualifizierten Arbeitszeugnisses. Arbeitgeber hat nach 6 Monaten noch kein Zeugnis ausgestellt.",
    expectedNormen: ["GewO SS 109", "BGB SS 630"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Zeugnis",
  },
  {
    id: "zeugnis-02",
    description: "Zeugnisberichtigung verlangen",
    query:
      "Zeugnis enthaelt versteckte negative Formulierungen. Mandant moechte Berichtigung.",
    expectedNormen: ["GewO SS 109", "BGB SS 241 Abs. 2"],
    expectedUrteile: [],
    expectedSections: ["Rubrum", "Antraege", "Sachverhalt"],
    schwerpunkt: "Zeugnis",
  },
  // --- Befristung ---
  {
    id: "befr-01",
    description: "Entfristungsklage",
    query:
      "Klage auf Feststellung dass das Arbeitsverhaeltnis unbefristet fortbesteht. Befristung war sachgrundlos, aber es gab vorher schon 3 befristete Vertraege.",
    expectedNormen: ["TzBfG SS 14", "TzBfG SS 17", "KSchG SS 4"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Befristung",
  },
  // --- Diskriminierung ---
  {
    id: "disk-01",
    description:
      "Entschaedigung wegen Diskriminierung im Bewerbungsverfahren",
    query:
      "Mandant wurde wegen seines Alters im Bewerbungsverfahren abgelehnt. Klage auf Entschaedigung nach AGG.",
    expectedNormen: ["AGG SS 1", "AGG SS 7", "AGG SS 15"],
    expectedUrteile: [],
    expectedSections: [
      "Rubrum",
      "Antraege",
      "Sachverhalt",
      "Rechtliche Wuerdigung",
    ],
    schwerpunkt: "Diskriminierung",
  },
];
