/**
 * XJustiz XML Parser
 *
 * Parses XJustiz XML documents (versions 3.4.1 through 3.5.1) into typed
 * TypeScript objects. Extracts Grunddaten, Beteiligte, Instanzen, and Termine.
 *
 * Uses fast-xml-parser with namespace stripping for version-agnostic parsing.
 * The parser is tolerant of unknown elements and gracefully handles malformed XML.
 *
 * Reference: openXJV (Python) for field mapping, XJustiz XSD schemas for structure.
 */

import { XMLParser } from "fast-xml-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface XJustizData {
  /** Detected XJustiz version */
  version: string;
  grunddaten?: {
    aktenzeichen?: string;
    verfahrensgegenstand?: string;
    gericht?: string;
    eingangsdatum?: string;
  };
  beteiligte: Array<{
    name: string;
    rolle: string;
    anschrift?: string;
    safeId?: string;
  }>;
  instanzen: Array<{
    gericht: string;
    aktenzeichen: string;
    beginn?: string;
    ende?: string;
  }>;
  termine: Array<{
    art: string;
    datum: string;
    ort?: string;
    bemerkung?: string;
  }>;
}

// ─── Parser Configuration ────────────────────────────────────────────────────

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Tolerant parsing: don't fail on unexpected structure
  isArray: (name: string) => {
    // Elements that should always be parsed as arrays
    const arrayTags = [
      "beteiligung",
      "beteiligter",
      "instanzdaten",
      "instanz",
      "terminsdaten",
      "termin",
      "terminMitBezug",
      "allgemeinerTermin",
      "verhandlungstermin",
      "rollenbezeichnung",
      "anschrift",
      "organisation",
      "natuerlichePerson",
      "person",
      "kanzlei",
      "ra_kanzlei",
    ];
    return arrayTags.includes(name);
  },
  // Parse text content
  textNodeName: "#text",
  // Trim whitespace
  trimValues: true,
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Safely navigates a nested object path, returning undefined if any step fails.
 */
function dig(obj: any, ...keys: string[]): any {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Ensures a value is an array (wraps single items).
 */
function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Extracts a text value from a potentially nested XML node.
 * XJustiz sometimes wraps simple values in nested elements.
 */
function extractText(node: any): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node["#text"] != null) return String(node["#text"]);
  // Try to find any text content in nested elements
  if (typeof node === "object") {
    const values = Object.values(node);
    for (const v of values) {
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return undefined;
}

/**
 * Formats a date from XJustiz (may be ISO, or structured with jahr/monat/tag).
 */
function extractDate(node: any): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node;

  // XJustiz structured date format
  const jahr = dig(node, "jahr") || dig(node, "year");
  const monat = dig(node, "monat") || dig(node, "month");
  const tag = dig(node, "tag") || dig(node, "day");

  if (jahr && monat && tag) {
    return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
  }

  return extractText(node);
}

/**
 * Extracts a person's display name from XJustiz beteiligung node.
 */
function extractPersonName(person: any): string {
  if (!person) return "Unbekannt";

  // Natural person
  const natuerlich = person.natuerlichePerson?.[0] || person.natuerlichePerson;
  if (natuerlich) {
    const vorname = extractText(natuerlich.vorname) ||
      extractText(dig(natuerlich, "vollerName", "vorname"));
    const nachname = extractText(natuerlich.nachname) ||
      extractText(natuerlich.familienname) ||
      extractText(dig(natuerlich, "vollerName", "nachname")) ||
      extractText(dig(natuerlich, "vollerName", "familienname"));
    if (nachname) {
      return vorname ? `${vorname} ${nachname}` : nachname;
    }
  }

  // Organization
  const org = person.organisation?.[0] || person.organisation;
  if (org) {
    return extractText(org.bezeichnung) ||
      extractText(dig(org, "bezeichnung", "volleBezeichnung")) ||
      extractText(org.name) ||
      "Unbekannte Organisation";
  }

  // Kanzlei
  const kanzlei = person.ra_kanzlei?.[0] || person.ra_kanzlei ||
    person.kanzlei?.[0] || person.kanzlei;
  if (kanzlei) {
    return extractText(kanzlei.bezeichnung) ||
      extractText(kanzlei.name) ||
      "Kanzlei";
  }

  return extractText(person.bezeichnung) || extractText(person.name) || "Unbekannt";
}

/**
 * Extracts a formatted address string from an XJustiz anschrift node.
 */
function extractAnschrift(node: any): string | undefined {
  if (!node) return undefined;
  const anschrift = Array.isArray(node) ? node[0] : node;
  if (!anschrift) return undefined;

  const strasse = extractText(anschrift.strasse);
  const hausnummer = extractText(anschrift.hausnummer);
  const plz = extractText(anschrift.postleitzahl) || extractText(anschrift.plz);
  const ort = extractText(anschrift.ort);
  const land = extractText(anschrift.staat) || extractText(anschrift.land);

  const parts: string[] = [];
  if (strasse) {
    parts.push(hausnummer ? `${strasse} ${hausnummer}` : strasse);
  }
  if (plz || ort) {
    parts.push([plz, ort].filter(Boolean).join(" "));
  }
  if (land && land !== "DE" && land !== "Deutschland") {
    parts.push(land);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Extracts the SAFE-ID from a beteiligung node.
 */
function extractSafeId(node: any): string | undefined {
  // SAFE-ID may be at various paths depending on version
  return extractText(node?.safeId) ||
    extractText(node?.SAFE_ID) ||
    extractText(dig(node, "kommunikation", "safeId")) ||
    extractText(dig(node, "telekommunikation", "safeId")) ||
    undefined;
}

// ─── Version Detection ───────────────────────────────────────────────────────

function detectVersion(parsed: any): string {
  // Check for version attribute on root element
  const root = parsed.nachricht || parsed.xjustiz || parsed.schriftsatz || parsed;
  const version = root?.["@_version"] || root?.["@_xjustizVersion"];
  if (version) return version;

  // Check for nachrichtenKopf version
  const kopf = dig(root, "nachrichtenKopf") || dig(root, "nachrichtenkopf");
  if (kopf) {
    const v = kopf["@_version"] || dig(kopf, "xjustizVersion");
    if (v) return extractText(v) || "unknown";
  }

  // Default based on namespace hints in the XML
  return "unknown";
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Parses an XJustiz XML string into typed data.
 * Supports versions 3.4.1 through 3.5.1.
 * Returns a safe default structure if parsing fails.
 */
export function parseXJustiz(xmlString: string): XJustizData {
  const emptyResult: XJustizData = {
    version: "unknown",
    beteiligte: [],
    instanzen: [],
    termine: [],
  };

  if (!xmlString || typeof xmlString !== "string" || xmlString.trim().length === 0) {
    return emptyResult;
  }

  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlString);

    if (!parsed || typeof parsed !== "object") {
      return emptyResult;
    }

    // Navigate to root element (may be wrapped in envelope)
    const root = parsed.nachricht || parsed.schriftsatz || parsed.xjustiz ||
      parsed.nachrichtenkopf || parsed;

    const version = detectVersion(parsed);
    const grunddaten = extractGrunddaten(root);
    const beteiligte = extractBeteiligte(root);
    const instanzen = extractInstanzen(root);
    const termine = extractTermine(root);

    return {
      version,
      grunddaten: grunddaten || undefined,
      beteiligte,
      instanzen,
      termine,
    };
  } catch {
    // Graceful failure on malformed XML
    return emptyResult;
  }
}

// ─── Extraction Functions ────────────────────────────────────────────────────

function extractGrunddaten(root: any): XJustizData["grunddaten"] | null {
  // Grunddaten may be at various paths depending on XJustiz version
  const grunddaten = root?.grunddaten || root?.nachrichtenKopf || root?.nachrichtenkopf;
  const fachdaten = root?.fachdaten || root?.schriftsatz;

  const aktenzeichen = extractText(dig(root, "aktenzeichen")) ||
    extractText(dig(grunddaten, "aktenzeichen")) ||
    extractText(dig(grunddaten, "aktenzeichen", "aktenzeichenFreitext")) ||
    extractText(dig(fachdaten, "aktenzeichen"));

  const verfahrensgegenstand = extractText(dig(root, "verfahrensgegenstand")) ||
    extractText(dig(grunddaten, "verfahrensgegenstand")) ||
    extractText(dig(fachdaten, "verfahrensgegenstand"));

  const gericht = extractText(dig(root, "gericht")) ||
    extractText(dig(root, "gericht", "bezeichnung")) ||
    extractText(dig(grunddaten, "gericht")) ||
    extractText(dig(grunddaten, "gericht", "bezeichnung"));

  const eingangsdatum = extractDate(dig(root, "eingangsdatum")) ||
    extractDate(dig(grunddaten, "eingangsdatum"));

  if (!aktenzeichen && !verfahrensgegenstand && !gericht && !eingangsdatum) {
    return null;
  }

  return { aktenzeichen, verfahrensgegenstand, gericht, eingangsdatum };
}

function extractBeteiligte(root: any): XJustizData["beteiligte"] {
  const result: XJustizData["beteiligte"] = [];

  // Beteiligte may be under beteiligung, rollenVerteilung, or directly
  const beteiligungen = ensureArray(
    root?.beteiligung || root?.rollenVerteilung?.beteiligung ||
    root?.fachdaten?.beteiligung
  );

  for (const b of beteiligungen) {
    if (!b) continue;

    const name = extractPersonName(b);
    const rollenBez = ensureArray(b.rollenbezeichnung);
    const rolle = rollenBez.length > 0
      ? (extractText(rollenBez[0]?.rollenbezeichnung) ||
        extractText(rollenBez[0]) ||
        "Beteiligter")
      : (extractText(b.rolle) || extractText(b.parteistellung) || "Beteiligter");

    const anschrift = extractAnschrift(
      b.anschrift || dig(b, "natuerlichePerson", "anschrift") ||
      dig(b, "organisation", "anschrift")
    );

    const safeId = extractSafeId(b) ||
      extractSafeId(dig(b, "natuerlichePerson")) ||
      extractSafeId(dig(b, "organisation"));

    result.push({ name, rolle, anschrift, safeId });
  }

  return result;
}

function extractInstanzen(root: any): XJustizData["instanzen"] {
  const result: XJustizData["instanzen"] = [];

  const instanzdaten = ensureArray(
    root?.instanzdaten || root?.fachdaten?.instanzdaten ||
    root?.instanz || root?.fachdaten?.instanz
  );

  for (const inst of instanzdaten) {
    if (!inst) continue;

    const gericht = extractText(inst.gericht) ||
      extractText(dig(inst, "gericht", "bezeichnung")) ||
      extractText(dig(inst, "auswahl_instanzbehoerde", "gericht", "bezeichnung")) ||
      "Unbekanntes Gericht";

    const aktenzeichen = extractText(inst.aktenzeichen) ||
      extractText(dig(inst, "aktenzeichen", "aktenzeichenFreitext")) ||
      "";

    const beginn = extractDate(inst.beginn) || extractDate(inst.eingangsdatum);
    const ende = extractDate(inst.ende) || extractDate(inst.abschlussdatum);

    result.push({ gericht, aktenzeichen, beginn, ende });
  }

  return result;
}

function extractTermine(root: any): XJustizData["termine"] {
  const result: XJustizData["termine"] = [];

  const terminLists = [
    ...ensureArray(root?.terminsdaten),
    ...ensureArray(root?.termin),
    ...ensureArray(root?.fachdaten?.terminsdaten),
    ...ensureArray(root?.fachdaten?.termin),
    ...ensureArray(root?.terminMitBezug),
    ...ensureArray(root?.allgemeinerTermin),
    ...ensureArray(root?.verhandlungstermin),
  ];

  for (const t of terminLists) {
    if (!t) continue;

    // May contain nested termin entries
    const nestedTermine = ensureArray(t.termin || t.terminMitBezug || t.allgemeinerTermin);
    const items = nestedTermine.length > 0 ? nestedTermine : [t];

    for (const item of items) {
      if (!item) continue;

      const art = extractText(item.terminart) ||
        extractText(item.art) ||
        extractText(item.termintyp) ||
        "Termin";

      const datum = extractDate(item.termindatum) ||
        extractDate(item.datum) ||
        extractDate(item.hauptterminsdatum) ||
        "";

      if (!datum) continue; // Skip entries without date

      const ort = extractText(item.ort) ||
        extractText(item.terminort) ||
        extractText(dig(item, "terminort", "gebaeude"));

      const bemerkung = extractText(item.bemerkung) ||
        extractText(item.hinweis) ||
        extractText(item.anmerkung);

      result.push({ art, datum, ort, bemerkung });
    }
  }

  return result;
}
