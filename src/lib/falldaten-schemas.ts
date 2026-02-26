/**
 * Sachgebietsspezifische Falldatenblätter
 *
 * JSON-Schema-based form definitions for each legal area (Sachgebiet).
 * Each field has a key, label, type, and optional metadata.
 * The actual data is stored as JSON in the Akte.falldaten column.
 */

export type FalldatenFeldTyp =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "currency";

export interface FalldatenFeld {
  key: string;
  label: string;
  typ: FalldatenFeldTyp;
  placeholder?: string;
  optionen?: { value: string; label: string }[];
  required?: boolean;
  gruppe?: string; // Group label for visual grouping
}

export interface FalldatenSchema {
  sachgebiet: string;
  label: string;
  beschreibung: string;
  felder: FalldatenFeld[];
}

// ─── Arbeitsrecht ───────────────────────────────────────────────────────────

const arbeitsrecht: FalldatenSchema = {
  sachgebiet: "ARBEITSRECHT",
  label: "Arbeitsrecht",
  beschreibung: "Falldatenblatt für arbeitsrechtliche Mandate",
  felder: [
    // Arbeitsverhältnis
    { key: "arbeitgeber", label: "Arbeitgeber", typ: "text", gruppe: "Arbeitsverhältnis" },
    { key: "arbeitnehmer", label: "Arbeitnehmer", typ: "text", gruppe: "Arbeitsverhältnis" },
    { key: "beschaeftigtSeit", label: "Beschäftigt seit", typ: "date", gruppe: "Arbeitsverhältnis" },
    { key: "taetigkeit", label: "Tätigkeit / Position", typ: "text", gruppe: "Arbeitsverhältnis" },
    { key: "bruttoMonatsgehalt", label: "Bruttomonatsgehalt", typ: "currency", gruppe: "Arbeitsverhältnis" },
    { key: "arbeitszeit", label: "Arbeitszeit (Std./Woche)", typ: "number", gruppe: "Arbeitsverhältnis" },
    { key: "befristet", label: "Befristetes Arbeitsverhältnis", typ: "boolean", gruppe: "Arbeitsverhältnis" },
    { key: "betriebsgroesse", label: "Betriebsgröße (Mitarbeiter)", typ: "number", gruppe: "Arbeitsverhältnis" },
    { key: "betriebsrat", label: "Betriebsrat vorhanden", typ: "boolean", gruppe: "Arbeitsverhältnis" },
    { key: "tarifvertrag", label: "Tarifvertrag", typ: "text", placeholder: "z.B. TVöD, Metall-Tarif", gruppe: "Arbeitsverhältnis" },
    // Kündigung
    { key: "kuendigungsart", label: "Kündigungsart", typ: "select", optionen: [
      { value: "ordentlich", label: "Ordentliche Kündigung" },
      { value: "ausserordentlich", label: "Außerordentliche Kündigung" },
      { value: "aenderungskuendigung", label: "Änderungskündigung" },
      { value: "aufhebungsvertrag", label: "Aufhebungsvertrag" },
      { value: "eigenkuendigung", label: "Eigenkündigung" },
      { value: "sonstige", label: "Sonstige" },
    ], gruppe: "Kündigung" },
    { key: "kuendigungsDatum", label: "Kündigungsdatum", typ: "date", gruppe: "Kündigung" },
    { key: "zugang", label: "Zugang der Kündigung", typ: "date", gruppe: "Kündigung" },
    { key: "kuendigungsFrist", label: "Kündigungsfrist", typ: "text", placeholder: "z.B. 4 Wochen zum 15./Ende", gruppe: "Kündigung" },
    { key: "kuendigungsGrund", label: "Kündigungsgrund", typ: "textarea", gruppe: "Kündigung" },
    { key: "abfindung", label: "Abfindungsangebot", typ: "currency", gruppe: "Kündigung" },
    // Fristen
    { key: "klagefrist3Wochen", label: "3-Wochen-Klagefrist bis", typ: "date", gruppe: "Fristen" },
    { key: "kuendigungsschutzklageErhoben", label: "Kündigungsschutzklage erhoben", typ: "boolean", gruppe: "Fristen" },
    // Sonderschutz
    { key: "schwerbehindert", label: "Schwerbehindert / Gleichgestellt", typ: "boolean", gruppe: "Besonderer Kündigungsschutz" },
    { key: "schwanger", label: "Schwanger / Elternzeit", typ: "boolean", gruppe: "Besonderer Kündigungsschutz" },
    { key: "datenschutzbeauftragter", label: "Datenschutzbeauftragte/r", typ: "boolean", gruppe: "Besonderer Kündigungsschutz" },
    { key: "betriebsratsmitglied", label: "Betriebsratsmitglied", typ: "boolean", gruppe: "Besonderer Kündigungsschutz" },
    // Notizen
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Familienrecht ──────────────────────────────────────────────────────────

const familienrecht: FalldatenSchema = {
  sachgebiet: "FAMILIENRECHT",
  label: "Familienrecht",
  beschreibung: "Falldatenblatt für familienrechtliche Mandate",
  felder: [
    // Ehepartner
    { key: "ehepartner1", label: "Ehepartner 1", typ: "text", gruppe: "Eheverhältnis" },
    { key: "ehepartner2", label: "Ehepartner 2", typ: "text", gruppe: "Eheverhältnis" },
    { key: "heiratsdatum", label: "Heiratsdatum", typ: "date", gruppe: "Eheverhältnis" },
    { key: "trennungsdatum", label: "Trennungsdatum", typ: "date", gruppe: "Eheverhältnis" },
    { key: "gueterstand", label: "Güterstand", typ: "select", optionen: [
      { value: "zugewinngemeinschaft", label: "Zugewinngemeinschaft" },
      { value: "guetertrennung", label: "Gütertrennung" },
      { value: "guetergemeinschaft", label: "Gütergemeinschaft" },
    ], gruppe: "Eheverhältnis" },
    { key: "ehevertrag", label: "Ehevertrag vorhanden", typ: "boolean", gruppe: "Eheverhältnis" },
    // Kinder
    { key: "anzahlKinder", label: "Anzahl gemeinsamer Kinder", typ: "number", gruppe: "Kinder" },
    { key: "kinderDetails", label: "Kinder (Name, Geb.-Datum)", typ: "textarea", placeholder: "Je Kind eine Zeile", gruppe: "Kinder" },
    { key: "sorgerecht", label: "Sorgerecht", typ: "select", optionen: [
      { value: "gemeinsam", label: "Gemeinsames Sorgerecht" },
      { value: "alleinig_mandant", label: "Alleiniges Sorgerecht (Mandant)" },
      { value: "alleinig_gegner", label: "Alleiniges Sorgerecht (Gegner)" },
      { value: "strittig", label: "Strittig" },
    ], gruppe: "Kinder" },
    { key: "umgangsregelung", label: "Umgangsregelung", typ: "textarea", gruppe: "Kinder" },
    // Unterhalt
    { key: "kindesunterhalt", label: "Kindesunterhalt monatlich", typ: "currency", gruppe: "Unterhalt" },
    { key: "ehegattenunterhalt", label: "Ehegattenunterhalt monatlich", typ: "currency", gruppe: "Unterhalt" },
    { key: "nettoEinkommenMandant", label: "Nettoeinkommen Mandant", typ: "currency", gruppe: "Unterhalt" },
    { key: "nettoEinkommenGegner", label: "Nettoeinkommen Gegner", typ: "currency", gruppe: "Unterhalt" },
    // Vermögen
    { key: "zugewinnausgleich", label: "Zugewinnausgleich", typ: "boolean", gruppe: "Vermögen" },
    { key: "immobilien", label: "Gemeinsame Immobilien", typ: "textarea", gruppe: "Vermögen" },
    { key: "versorgungsausgleich", label: "Versorgungsausgleich", typ: "boolean", gruppe: "Vermögen" },
    // Verfahren
    { key: "verfahrensart", label: "Verfahrensart", typ: "select", optionen: [
      { value: "scheidung", label: "Scheidung" },
      { value: "unterhalt", label: "Unterhalt" },
      { value: "sorgerecht", label: "Sorgerecht / Umgang" },
      { value: "zugewinn", label: "Zugewinnausgleich" },
      { value: "eav", label: "Einstweilige Anordnung" },
      { value: "sonstige", label: "Sonstige" },
    ], gruppe: "Verfahren" },
    { key: "vkh", label: "VKH beantragt / bewilligt", typ: "select", optionen: [
      { value: "nein", label: "Nicht beantragt" },
      { value: "beantragt", label: "Beantragt" },
      { value: "bewilligt", label: "Bewilligt" },
      { value: "abgelehnt", label: "Abgelehnt" },
    ], gruppe: "Verfahren" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Verkehrsrecht ──────────────────────────────────────────────────────────

const verkehrsrecht: FalldatenSchema = {
  sachgebiet: "VERKEHRSRECHT",
  label: "Verkehrsrecht",
  beschreibung: "Falldatenblatt für verkehrsrechtliche Mandate (Unfallschaden)",
  felder: [
    // Unfall
    { key: "unfalldatum", label: "Unfalldatum", typ: "date", gruppe: "Unfalldaten" },
    { key: "unfallort", label: "Unfallort", typ: "text", gruppe: "Unfalldaten" },
    { key: "unfallhergang", label: "Unfallhergang", typ: "textarea", gruppe: "Unfalldaten" },
    { key: "polizeiAufgenommen", label: "Polizeilich aufgenommen", typ: "boolean", gruppe: "Unfalldaten" },
    { key: "aktenzeichenPolizei", label: "Aktenzeichen Polizei", typ: "text", gruppe: "Unfalldaten" },
    { key: "haftungsquote", label: "Haftungsquote (%)", typ: "number", placeholder: "z.B. 100", gruppe: "Unfalldaten" },
    // Fahrzeug
    { key: "fahrzeugMandant", label: "Fahrzeug Mandant (Typ/Kennz.)", typ: "text", gruppe: "Fahrzeugdaten" },
    { key: "fahrzeugGegner", label: "Fahrzeug Gegner (Typ/Kennz.)", typ: "text", gruppe: "Fahrzeugdaten" },
    // Versicherung
    { key: "gegnerischeVersicherung", label: "Gegnerische Versicherung", typ: "text", gruppe: "Versicherung" },
    { key: "schadennummer", label: "Schadennummer", typ: "text", gruppe: "Versicherung" },
    { key: "kaskoversicherung", label: "Kaskoversicherung Mandant", typ: "select", optionen: [
      { value: "keine", label: "Keine" },
      { value: "teilkasko", label: "Teilkasko" },
      { value: "vollkasko", label: "Vollkasko" },
    ], gruppe: "Versicherung" },
    // Schäden
    { key: "reparaturkosten", label: "Reparaturkosten (netto)", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "wiederbeschaffungswert", label: "Wiederbeschaffungswert", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "restwert", label: "Restwert", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "mietwagen", label: "Mietwagenkosten", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "nutzungsausfall", label: "Nutzungsausfallentschädigung", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "schmerzensgeld", label: "Schmerzensgeld", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "gutachterkosten", label: "Gutachterkosten", typ: "currency", gruppe: "Schadenshöhe" },
    { key: "unkostenpauschale", label: "Unkostenpauschale", typ: "currency", gruppe: "Schadenshöhe" },
    // Verletzungen
    { key: "personenschaden", label: "Personenschaden", typ: "boolean", gruppe: "Verletzungen" },
    { key: "verletzungen", label: "Art der Verletzungen", typ: "textarea", gruppe: "Verletzungen" },
    { key: "arbeitsunfaehigTage", label: "Arbeitsunfähig (Tage)", typ: "number", gruppe: "Verletzungen" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Mietrecht ──────────────────────────────────────────────────────────────

const mietrecht: FalldatenSchema = {
  sachgebiet: "MIETRECHT",
  label: "Mietrecht",
  beschreibung: "Falldatenblatt für mietrechtliche Mandate",
  felder: [
    // Mietobjekt
    { key: "mietobjektAdresse", label: "Adresse des Mietobjekts", typ: "text", gruppe: "Mietobjekt" },
    { key: "mietobjektArt", label: "Art des Mietobjekts", typ: "select", optionen: [
      { value: "wohnung", label: "Wohnung" },
      { value: "haus", label: "Haus" },
      { value: "gewerbe", label: "Gewerberaum" },
      { value: "garage", label: "Garage / Stellplatz" },
    ], gruppe: "Mietobjekt" },
    { key: "wohnflaeche", label: "Wohnfläche (m²)", typ: "number", gruppe: "Mietobjekt" },
    { key: "zimmeranzahl", label: "Zimmeranzahl", typ: "number", gruppe: "Mietobjekt" },
    // Mietvertrag
    { key: "mietbeginn", label: "Mietbeginn", typ: "date", gruppe: "Mietvertrag" },
    { key: "befristet", label: "Befristeter Mietvertrag", typ: "boolean", gruppe: "Mietvertrag" },
    { key: "kaltmiete", label: "Kaltmiete (monatlich)", typ: "currency", gruppe: "Mietvertrag" },
    { key: "nebenkosten", label: "Nebenkosten (monatlich)", typ: "currency", gruppe: "Mietvertrag" },
    { key: "kaution", label: "Kaution", typ: "currency", gruppe: "Mietvertrag" },
    { key: "kautionHinterlegt", label: "Kaution hinterlegt", typ: "boolean", gruppe: "Mietvertrag" },
    // Streitgegenstand
    { key: "streitgegenstand", label: "Streitgegenstand", typ: "select", optionen: [
      { value: "kuendigung", label: "Kündigung" },
      { value: "mietminderung", label: "Mietminderung / Mängel" },
      { value: "nebenkostenabrechnung", label: "Nebenkostenabrechnung" },
      { value: "kaution", label: "Kaution" },
      { value: "mieterhoehung", label: "Mieterhöhung" },
      { value: "raeumung", label: "Räumung" },
      { value: "sonstige", label: "Sonstige" },
    ], gruppe: "Streit" },
    { key: "maengel", label: "Mängel (Beschreibung)", typ: "textarea", gruppe: "Streit" },
    { key: "minderungsquote", label: "Minderungsquote (%)", typ: "number", gruppe: "Streit" },
    { key: "mietrueckstand", label: "Mietrückstand", typ: "currency", gruppe: "Streit" },
    { key: "kuendigungErhalten", label: "Kündigung erhalten am", typ: "date", gruppe: "Streit" },
    { key: "raeumungsfrist", label: "Räumungsfrist bis", typ: "date", gruppe: "Streit" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Strafrecht ─────────────────────────────────────────────────────────────

const strafrecht: FalldatenSchema = {
  sachgebiet: "STRAFRECHT",
  label: "Strafrecht",
  beschreibung: "Falldatenblatt für strafrechtliche Mandate",
  felder: [
    // Verfahren
    { key: "aktenzeichenStA", label: "Aktenzeichen StA", typ: "text", gruppe: "Verfahren" },
    { key: "aktenzeichenGericht", label: "Aktenzeichen Gericht", typ: "text", gruppe: "Verfahren" },
    { key: "tatvorwurf", label: "Tatvorwurf / Delikte", typ: "textarea", gruppe: "Verfahren" },
    { key: "tatdatum", label: "Tatdatum", typ: "date", gruppe: "Verfahren" },
    { key: "tatort", label: "Tatort", typ: "text", gruppe: "Verfahren" },
    { key: "verfahrensstand", label: "Verfahrensstand", typ: "select", optionen: [
      { value: "ermittlungsverfahren", label: "Ermittlungsverfahren" },
      { value: "zwischenverfahren", label: "Zwischenverfahren" },
      { value: "hauptverfahren", label: "Hauptverfahren" },
      { value: "berufung", label: "Berufung" },
      { value: "revision", label: "Revision" },
      { value: "eingestellt", label: "Eingestellt" },
      { value: "strafbefehl", label: "Strafbefehl" },
    ], gruppe: "Verfahren" },
    // Beschuldigter
    { key: "vorstrafen", label: "Vorstrafen", typ: "boolean", gruppe: "Beschuldigter" },
    { key: "vorbestraft", label: "Vorstrafen (Details)", typ: "textarea", gruppe: "Beschuldigter" },
    { key: "uHaft", label: "Untersuchungshaft", typ: "boolean", gruppe: "Beschuldigter" },
    { key: "uHaftSeit", label: "U-Haft seit", typ: "date", gruppe: "Beschuldigter" },
    { key: "bewertung", label: "Bewertung / Verteidigungsstrategie", typ: "textarea", gruppe: "Beschuldigter" },
    // Ergebnisse
    { key: "hauptverhandlungstermin", label: "Hauptverhandlungstermin", typ: "date", gruppe: "Ergebnis" },
    { key: "urteil", label: "Urteil / Ergebnis", typ: "textarea", gruppe: "Ergebnis" },
    { key: "pflichtverteidiger", label: "Pflichtverteidiger", typ: "boolean", gruppe: "Verteidigung" },
    { key: "nebenklage", label: "Nebenklage", typ: "boolean", gruppe: "Verteidigung" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Remaining Sachgebiete (simplified templates) ───────────────────────────

const erbrecht: FalldatenSchema = {
  sachgebiet: "ERBRECHT",
  label: "Erbrecht",
  beschreibung: "Falldatenblatt für erbrechtliche Mandate",
  felder: [
    { key: "erblasser", label: "Erblasser", typ: "text", gruppe: "Erbfall" },
    { key: "todesdatum", label: "Todesdatum", typ: "date", gruppe: "Erbfall" },
    { key: "letzterWohnsitz", label: "Letzter Wohnsitz", typ: "text", gruppe: "Erbfall" },
    { key: "testamentVorhanden", label: "Testament vorhanden", typ: "boolean", gruppe: "Erbfall" },
    { key: "testamentArt", label: "Art des Testaments", typ: "select", optionen: [
      { value: "eigenhaendig", label: "Eigenhändig" },
      { value: "notariell", label: "Notariell" },
      { value: "erbvertrag", label: "Erbvertrag" },
      { value: "keines", label: "Kein Testament" },
    ], gruppe: "Erbfall" },
    { key: "erbschein", label: "Erbschein beantragt/erteilt", typ: "select", optionen: [
      { value: "nein", label: "Nicht beantragt" },
      { value: "beantragt", label: "Beantragt" },
      { value: "erteilt", label: "Erteilt" },
    ], gruppe: "Erbfall" },
    { key: "erben", label: "Erben (Name, Quote)", typ: "textarea", gruppe: "Erben" },
    { key: "pflichtteil", label: "Pflichtteilsanspruch", typ: "boolean", gruppe: "Erben" },
    { key: "nachlasswert", label: "Nachlasswert (geschätzt)", typ: "currency", gruppe: "Nachlass" },
    { key: "nachlassverzeichnis", label: "Nachlassverzeichnis", typ: "textarea", gruppe: "Nachlass" },
    { key: "nachlassverbindlichkeiten", label: "Nachlassverbindlichkeiten", typ: "currency", gruppe: "Nachlass" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

const sozialrecht: FalldatenSchema = {
  sachgebiet: "SOZIALRECHT",
  label: "Sozialrecht",
  beschreibung: "Falldatenblatt für sozialrechtliche Mandate",
  felder: [
    { key: "traeger", label: "Leistungsträger", typ: "text", gruppe: "Verfahren" },
    { key: "bescheidDatum", label: "Bescheiddatum", typ: "date", gruppe: "Verfahren" },
    { key: "widerspruchFrist", label: "Widerspruchsfrist bis", typ: "date", gruppe: "Verfahren" },
    { key: "leistungsart", label: "Leistungsart", typ: "select", optionen: [
      { value: "buergergeld", label: "Bürgergeld (SGB II)" },
      { value: "rente", label: "Rente (SGB VI)" },
      { value: "krankenversicherung", label: "Krankenversicherung (SGB V)" },
      { value: "schwerbehinderung", label: "Schwerbehinderung (SGB IX)" },
      { value: "unfallversicherung", label: "Unfallversicherung (SGB VII)" },
      { value: "pflegeversicherung", label: "Pflegeversicherung (SGB XI)" },
      { value: "kindergeld", label: "Kindergeld" },
      { value: "sonstige", label: "Sonstige" },
    ], gruppe: "Verfahren" },
    { key: "verfahrensstand", label: "Verfahrensstand", typ: "select", optionen: [
      { value: "widerspruch", label: "Widerspruchsverfahren" },
      { value: "klage", label: "Klageverfahren" },
      { value: "berufung", label: "Berufung" },
      { value: "revision", label: "Revision" },
    ], gruppe: "Verfahren" },
    { key: "gradDerBehinderung", label: "GdB (Grad der Behinderung)", typ: "number", gruppe: "Details" },
    { key: "erwerbsminderung", label: "Erwerbsminderung", typ: "select", optionen: [
      { value: "keine", label: "Keine" },
      { value: "teilweise", label: "Teilweise" },
      { value: "voll", label: "Volle" },
    ], gruppe: "Details" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

const inkasso: FalldatenSchema = {
  sachgebiet: "INKASSO",
  label: "Inkasso / Forderungseinzug",
  beschreibung: "Falldatenblatt für Inkasso- und Forderungsmandate",
  felder: [
    { key: "hauptforderung", label: "Hauptforderung", typ: "currency", gruppe: "Forderung" },
    { key: "zinsenAb", label: "Zinsen ab", typ: "date", gruppe: "Forderung" },
    { key: "zinssatz", label: "Zinssatz (% über Basiszins)", typ: "number", placeholder: "z.B. 5 oder 9", gruppe: "Forderung" },
    { key: "forderungsgrund", label: "Forderungsgrund", typ: "textarea", gruppe: "Forderung" },
    { key: "rechnungsDatum", label: "Rechnungsdatum", typ: "date", gruppe: "Forderung" },
    { key: "faelligSeit", label: "Fällig seit", typ: "date", gruppe: "Forderung" },
    { key: "mahnungenAnzahl", label: "Anzahl Mahnungen", typ: "number", gruppe: "Mahnverfahren" },
    { key: "letzteMahnung", label: "Letzte Mahnung am", typ: "date", gruppe: "Mahnverfahren" },
    { key: "mahnbescheid", label: "Mahnbescheid beantragt", typ: "boolean", gruppe: "Mahnverfahren" },
    { key: "vollstreckungsbescheid", label: "Vollstreckungsbescheid", typ: "boolean", gruppe: "Mahnverfahren" },
    { key: "titelvorhanden", label: "Titel vorhanden", typ: "boolean", gruppe: "Zwangsvollstreckung" },
    { key: "vollstreckungsmassnahmen", label: "Vollstreckungsmaßnahmen", typ: "textarea", gruppe: "Zwangsvollstreckung" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

const handelsrecht: FalldatenSchema = {
  sachgebiet: "HANDELSRECHT",
  label: "Handels- und Gesellschaftsrecht",
  beschreibung: "Falldatenblatt für handelsrechtliche Mandate",
  felder: [
    { key: "gesellschaftsform", label: "Gesellschaftsform", typ: "select", optionen: [
      { value: "gmbh", label: "GmbH" },
      { value: "ug", label: "UG (haftungsbeschränkt)" },
      { value: "ag", label: "AG" },
      { value: "ohg", label: "OHG" },
      { value: "kg", label: "KG" },
      { value: "gbr", label: "GbR" },
      { value: "ev", label: "e.V." },
      { value: "sonstige", label: "Sonstige" },
    ], gruppe: "Gesellschaft" },
    { key: "firma", label: "Firma", typ: "text", gruppe: "Gesellschaft" },
    { key: "registerGericht", label: "Registergericht", typ: "text", gruppe: "Gesellschaft" },
    { key: "hrNummer", label: "HR-Nummer", typ: "text", gruppe: "Gesellschaft" },
    { key: "gegenstand", label: "Streitgegenstand", typ: "textarea", gruppe: "Verfahren" },
    { key: "streitwert", label: "Streitwert", typ: "currency", gruppe: "Verfahren" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

const verwaltungsrecht: FalldatenSchema = {
  sachgebiet: "VERWALTUNGSRECHT",
  label: "Verwaltungsrecht",
  beschreibung: "Falldatenblatt für verwaltungsrechtliche Mandate",
  felder: [
    { key: "behoerde", label: "Behörde", typ: "text", gruppe: "Verfahren" },
    { key: "bescheidDatum", label: "Bescheiddatum", typ: "date", gruppe: "Verfahren" },
    { key: "widerspruchFrist", label: "Widerspruchsfrist bis", typ: "date", gruppe: "Verfahren" },
    { key: "gegenstand", label: "Streitgegenstand", typ: "textarea", gruppe: "Verfahren" },
    { key: "verfahrensart", label: "Verfahrensart", typ: "select", optionen: [
      { value: "anfechtungsklage", label: "Anfechtungsklage" },
      { value: "verpflichtungsklage", label: "Verpflichtungsklage" },
      { value: "feststellungsklage", label: "Feststellungsklage" },
      { value: "eilverfahren", label: "Eilverfahren" },
      { value: "widerspruch", label: "Widerspruchsverfahren" },
    ], gruppe: "Verfahren" },
    { key: "besonderheiten", label: "Besonderheiten", typ: "textarea", gruppe: "Sonstiges" },
  ],
};

// ─── Schema Registry ────────────────────────────────────────────────────────

export const falldatenSchemas: Record<string, FalldatenSchema> = {
  ARBEITSRECHT: arbeitsrecht,
  FAMILIENRECHT: familienrecht,
  VERKEHRSRECHT: verkehrsrecht,
  MIETRECHT: mietrecht,
  STRAFRECHT: strafrecht,
  ERBRECHT: erbrecht,
  SOZIALRECHT: sozialrecht,
  INKASSO: inkasso,
  HANDELSRECHT: handelsrecht,
  VERWALTUNGSRECHT: verwaltungsrecht,
};

/**
 * Get the Falldaten schema for a given Sachgebiet.
 * Returns null for SONSTIGES or unknown Sachgebiete.
 */
export function getFalldatenSchema(sachgebiet: string): FalldatenSchema | null {
  return falldatenSchemas[sachgebiet] ?? null;
}
