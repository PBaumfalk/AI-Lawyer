/**
 * Template placeholder engine for document generation.
 *
 * Supports placeholders like {{mandant.name}}, {{akte.aktenzeichen}}, etc.
 * Uses docxtemplater for DOCX processing.
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

// ─── Placeholder Definitions ─────────────────────────────────────────────────

export interface PlatzhalterGruppe {
  label: string;
  prefix: string;
  felder: { key: string; label: string; beispiel: string }[];
}

/**
 * All available placeholder groups with their fields.
 * These define what data can be injected into templates.
 */
export const PLATZHALTER_GRUPPEN: PlatzhalterGruppe[] = [
  {
    label: "Akte",
    prefix: "akte",
    felder: [
      { key: "akte.aktenzeichen", label: "Aktenzeichen", beispiel: "00042/26" },
      { key: "akte.kurzrubrum", label: "Kurzrubrum", beispiel: "Müller ./. Schmidt" },
      { key: "akte.wegen", label: "Wegen", beispiel: "Schadensersatz" },
      { key: "akte.sachgebiet", label: "Sachgebiet", beispiel: "Verkehrsrecht" },
      { key: "akte.gegenstandswert", label: "Gegenstandswert", beispiel: "5.000,00 €" },
    ],
  },
  {
    label: "Mandant",
    prefix: "mandant",
    felder: [
      { key: "mandant.anrede", label: "Anrede", beispiel: "Herr" },
      { key: "mandant.titel", label: "Titel", beispiel: "Dr." },
      { key: "mandant.vorname", label: "Vorname", beispiel: "Max" },
      { key: "mandant.nachname", label: "Nachname", beispiel: "Müller" },
      { key: "mandant.name", label: "Vollständiger Name", beispiel: "Max Müller" },
      { key: "mandant.firma", label: "Firma", beispiel: "Müller GmbH" },
      { key: "mandant.strasse", label: "Straße", beispiel: "Musterstr. 1" },
      { key: "mandant.plz", label: "PLZ", beispiel: "44135" },
      { key: "mandant.ort", label: "Ort", beispiel: "Dortmund" },
      { key: "mandant.anschrift", label: "Vollständige Anschrift", beispiel: "Musterstr. 1, 44135 Dortmund" },
      { key: "mandant.email", label: "E-Mail", beispiel: "max@example.de" },
      { key: "mandant.telefon", label: "Telefon", beispiel: "0231 1234567" },
    ],
  },
  {
    label: "Gegner",
    prefix: "gegner",
    felder: [
      { key: "gegner.anrede", label: "Anrede", beispiel: "Frau" },
      { key: "gegner.titel", label: "Titel", beispiel: "" },
      { key: "gegner.vorname", label: "Vorname", beispiel: "Anna" },
      { key: "gegner.nachname", label: "Nachname", beispiel: "Schmidt" },
      { key: "gegner.name", label: "Vollständiger Name", beispiel: "Anna Schmidt" },
      { key: "gegner.firma", label: "Firma", beispiel: "Schmidt & Co. KG" },
      { key: "gegner.strasse", label: "Straße", beispiel: "Hauptstr. 10" },
      { key: "gegner.plz", label: "PLZ", beispiel: "44137" },
      { key: "gegner.ort", label: "Ort", beispiel: "Dortmund" },
      { key: "gegner.anschrift", label: "Vollständige Anschrift", beispiel: "Hauptstr. 10, 44137 Dortmund" },
      { key: "gegner.email", label: "E-Mail", beispiel: "anna@example.de" },
      { key: "gegner.telefon", label: "Telefon", beispiel: "0231 9876543" },
    ],
  },
  {
    label: "Gegnervertreter",
    prefix: "gegnervertreter",
    felder: [
      { key: "gegnervertreter.name", label: "Name", beispiel: "RA Meyer" },
      { key: "gegnervertreter.firma", label: "Kanzlei", beispiel: "Meyer & Partner" },
      { key: "gegnervertreter.anschrift", label: "Anschrift", beispiel: "Parkstr. 5, 44139 Dortmund" },
    ],
  },
  {
    label: "Gericht",
    prefix: "gericht",
    felder: [
      { key: "gericht.name", label: "Name", beispiel: "Amtsgericht Dortmund" },
      { key: "gericht.anschrift", label: "Anschrift", beispiel: "Gerichtsstr. 22, 44135 Dortmund" },
    ],
  },
  {
    label: "Anwalt",
    prefix: "anwalt",
    felder: [
      { key: "anwalt.name", label: "Name des Anwalts", beispiel: "RA Baumfalk" },
      { key: "anwalt.email", label: "E-Mail", beispiel: "baumfalk@kanzlei.de" },
      { key: "anwalt.telefon", label: "Telefon", beispiel: "0231 5551234" },
    ],
  },
  {
    label: "Kanzlei",
    prefix: "kanzlei",
    felder: [
      { key: "kanzlei.name", label: "Kanzleiname", beispiel: "Kanzlei Baumfalk" },
      { key: "kanzlei.strasse", label: "Straße", beispiel: "Kanzleistr. 1" },
      { key: "kanzlei.plz", label: "PLZ", beispiel: "44135" },
      { key: "kanzlei.ort", label: "Ort", beispiel: "Dortmund" },
      { key: "kanzlei.anschrift", label: "Vollständige Anschrift", beispiel: "Kanzleistr. 1, 44135 Dortmund" },
      { key: "kanzlei.telefon", label: "Telefon", beispiel: "0231 5550000" },
      { key: "kanzlei.fax", label: "Fax", beispiel: "0231 5550001" },
      { key: "kanzlei.email", label: "E-Mail", beispiel: "info@kanzlei.de" },
      { key: "kanzlei.website", label: "Website", beispiel: "www.kanzlei.de" },
      { key: "kanzlei.steuernr", label: "Steuernummer", beispiel: "123/456/78901" },
      { key: "kanzlei.ustIdNr", label: "USt-IdNr.", beispiel: "DE123456789" },
      { key: "kanzlei.iban", label: "IBAN", beispiel: "DE89 3704 0044 0532 0130 00" },
      { key: "kanzlei.bic", label: "BIC", beispiel: "COBADEFFXXX" },
      { key: "kanzlei.bankName", label: "Bank", beispiel: "Commerzbank Dortmund" },
    ],
  },
  {
    label: "Datum",
    prefix: "datum",
    felder: [
      { key: "datum.heute", label: "Heutiges Datum", beispiel: "23.02.2026" },
      { key: "datum.jahr", label: "Aktuelles Jahr", beispiel: "2026" },
    ],
  },
];

/**
 * Flat map of all available placeholder keys for quick lookup.
 */
export const ALLE_PLATZHALTER = PLATZHALTER_GRUPPEN.flatMap((g) =>
  g.felder.map((f) => f.key)
);

// ─── Placeholder Resolution ─────────────────────────────────────────────────

interface KontaktData {
  anrede?: string | null;
  titel?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  email?: string | null;
  telefon?: string | null;
}

interface AkteData {
  aktenzeichen: string;
  kurzrubrum: string;
  wegen?: string | null;
  sachgebiet: string;
  gegenstandswert?: any; // Decimal
  anwalt?: { name: string; email?: string | null; telefon?: string | null } | null;
  kanzlei?: {
    name: string;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
    telefon?: string | null;
    fax?: string | null;
    email?: string | null;
    website?: string | null;
    steuernr?: string | null;
    ustIdNr?: string | null;
    iban?: string | null;
    bic?: string | null;
    bankName?: string | null;
  } | null;
  beteiligte: {
    rolle: string;
    kontakt: KontaktData;
  }[];
}

const SACHGEBIET_LABELS: Record<string, string> = {
  ARBEITSRECHT: "Arbeitsrecht",
  FAMILIENRECHT: "Familienrecht",
  VERKEHRSRECHT: "Verkehrsrecht",
  MIETRECHT: "Mietrecht",
  STRAFRECHT: "Strafrecht",
  ERBRECHT: "Erbrecht",
  SOZIALRECHT: "Sozialrecht",
  INKASSO: "Inkasso",
  HANDELSRECHT: "Handelsrecht",
  VERWALTUNGSRECHT: "Verwaltungsrecht",
  SONSTIGES: "Sonstiges",
};

function formatAnschrift(k: KontaktData): string {
  const parts = [];
  if (k.strasse) parts.push(k.strasse);
  if (k.plz || k.ort) parts.push([k.plz, k.ort].filter(Boolean).join(" "));
  return parts.join(", ");
}

function formatName(k: KontaktData): string {
  if (k.firma) return k.firma;
  return [k.titel, k.vorname, k.nachname].filter(Boolean).join(" ");
}

function formatCurrency(value: any): string {
  if (value === null || value === undefined) return "";
  const num = parseFloat(String(value));
  if (isNaN(num)) return "";
  return num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function findBeteiligter(beteiligte: AkteData["beteiligte"], rolle: string): KontaktData | null {
  const b = beteiligte.find((b) => b.rolle === rolle);
  return b?.kontakt ?? null;
}

/**
 * Resolve all placeholder values from case data.
 * Returns a flat object: { "mandant.name": "Max Müller", ... }
 */
export function resolvePlatzhalter(akte: AkteData): Record<string, string> {
  const mandant = findBeteiligter(akte.beteiligte, "MANDANT");
  const gegner = findBeteiligter(akte.beteiligte, "GEGNER");
  const gegnervertreter = findBeteiligter(akte.beteiligte, "GEGNERVERTRETER");
  const gericht = findBeteiligter(akte.beteiligte, "GERICHT");
  const anwalt = akte.anwalt;
  const kanzlei = akte.kanzlei;

  const now = new Date();

  const data: Record<string, string> = {
    // Akte
    "akte.aktenzeichen": akte.aktenzeichen,
    "akte.kurzrubrum": akte.kurzrubrum,
    "akte.wegen": akte.wegen ?? "",
    "akte.sachgebiet": SACHGEBIET_LABELS[akte.sachgebiet] ?? akte.sachgebiet,
    "akte.gegenstandswert": formatCurrency(akte.gegenstandswert),

    // Mandant
    "mandant.anrede": mandant?.anrede ?? "",
    "mandant.titel": mandant?.titel ?? "",
    "mandant.vorname": mandant?.vorname ?? "",
    "mandant.nachname": mandant?.nachname ?? "",
    "mandant.name": mandant ? formatName(mandant) : "",
    "mandant.firma": mandant?.firma ?? "",
    "mandant.strasse": mandant?.strasse ?? "",
    "mandant.plz": mandant?.plz ?? "",
    "mandant.ort": mandant?.ort ?? "",
    "mandant.anschrift": mandant ? formatAnschrift(mandant) : "",
    "mandant.email": mandant?.email ?? "",
    "mandant.telefon": mandant?.telefon ?? "",

    // Gegner
    "gegner.anrede": gegner?.anrede ?? "",
    "gegner.titel": gegner?.titel ?? "",
    "gegner.vorname": gegner?.vorname ?? "",
    "gegner.nachname": gegner?.nachname ?? "",
    "gegner.name": gegner ? formatName(gegner) : "",
    "gegner.firma": gegner?.firma ?? "",
    "gegner.strasse": gegner?.strasse ?? "",
    "gegner.plz": gegner?.plz ?? "",
    "gegner.ort": gegner?.ort ?? "",
    "gegner.anschrift": gegner ? formatAnschrift(gegner) : "",
    "gegner.email": gegner?.email ?? "",
    "gegner.telefon": gegner?.telefon ?? "",

    // Gegnervertreter
    "gegnervertreter.name": gegnervertreter ? formatName(gegnervertreter) : "",
    "gegnervertreter.firma": gegnervertreter?.firma ?? "",
    "gegnervertreter.anschrift": gegnervertreter ? formatAnschrift(gegnervertreter) : "",

    // Gericht
    "gericht.name": gericht ? formatName(gericht) : "",
    "gericht.anschrift": gericht ? formatAnschrift(gericht) : "",

    // Anwalt
    "anwalt.name": anwalt?.name ?? "",
    "anwalt.email": anwalt?.email ?? "",
    "anwalt.telefon": anwalt?.telefon ?? "",

    // Kanzlei
    "kanzlei.name": kanzlei?.name ?? "",
    "kanzlei.strasse": kanzlei?.strasse ?? "",
    "kanzlei.plz": kanzlei?.plz ?? "",
    "kanzlei.ort": kanzlei?.ort ?? "",
    "kanzlei.anschrift": kanzlei
      ? [kanzlei.strasse, [kanzlei.plz, kanzlei.ort].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ")
      : "",
    "kanzlei.telefon": kanzlei?.telefon ?? "",
    "kanzlei.fax": kanzlei?.fax ?? "",
    "kanzlei.email": kanzlei?.email ?? "",
    "kanzlei.website": kanzlei?.website ?? "",
    "kanzlei.steuernr": kanzlei?.steuernr ?? "",
    "kanzlei.ustIdNr": kanzlei?.ustIdNr ?? "",
    "kanzlei.iban": kanzlei?.iban ?? "",
    "kanzlei.bic": kanzlei?.bic ?? "",
    "kanzlei.bankName": kanzlei?.bankName ?? "",

    // Datum
    "datum.heute": now.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    "datum.jahr": String(now.getFullYear()),
  };

  return data;
}

// ─── Blank DOCX Creation ────────────────────────────────────────────────────

/**
 * Create a minimal valid blank DOCX file.
 * Returns a Buffer containing a valid DOCX with an empty paragraph.
 */
export function createBlankDocx(): Buffer {
  const zip = new PizZip();

  // Minimal content types
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      "</Types>"
  );

  // Package relationships
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>"
  );

  // Word relationships
  zip.file(
    "word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>"
  );

  // Main document with one empty paragraph
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
      'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
      'xmlns:v="urn:schemas-microsoft-com:vml" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
      'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
      'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
      'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ' +
      'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
      'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
      'mc:Ignorable="w14 wp14">' +
      "<w:body>" +
      "<w:p><w:pPr><w:rPr><w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/></w:rPr></w:pPr></w:p>" +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
      "</w:body>" +
      "</w:document>"
  );

  // Minimal styles
  zip.file(
    "word/styles.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
      "<w:name w:val=\"Normal\"/>" +
      '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>' +
      "</w:style>" +
      "</w:styles>"
  );

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

// ─── DOCX Processing ────────────────────────────────────────────────────────

/**
 * Extract placeholder keys from a DOCX template file.
 * Scans for patterns like {akte.aktenzeichen} in the document text.
 */
export function extractPlatzhalterFromDocx(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  // Get the parsed tags (placeholders) from the template
  const tags = doc.getFullText();
  const regex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(tags)) !== null) {
    found.add(match[1]);
  }

  // Also scan the raw XML for placeholders that might be split across runs
  const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/header3.xml", "word/footer1.xml", "word/footer2.xml", "word/footer3.xml"];
  for (const xmlFile of xmlFiles) {
    try {
      const content = zip.file(xmlFile)?.asText();
      if (content) {
        // Remove XML tags to get clean text, then search for placeholders
        const cleanText = content.replace(/<[^>]+>/g, "");
        let xmlMatch;
        while ((xmlMatch = regex.exec(cleanText)) !== null) {
          found.add(xmlMatch[1]);
        }
      }
    } catch {
      // File may not exist in all templates
    }
  }

  return Array.from(found).sort();
}

/**
 * Custom field definition as stored in DokumentVorlage.customFelder JSON.
 */
export interface CustomFeldDefinition {
  key: string;
  label: string;
  typ: "TEXT" | "NUMBER" | "DATE" | "DROPDOWN";
  optionen?: string[];
}

/**
 * Convert flat dotted-key data to nested object for docxtemplater.
 * e.g. { "mandant.name": "Mueller" } -> { mandant: { name: "Mueller" } }
 * Also handles arrays and non-dotted keys.
 */
function toNestedData(data: Record<string, unknown>): Record<string, unknown> {
  const nested: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    if (parts.length === 2) {
      if (!nested[parts[0]] || typeof nested[parts[0]] !== "object" || Array.isArray(nested[parts[0]])) {
        // Only create nested object if not already set to a non-object (e.g. an array)
        if (!nested[parts[0]] || typeof nested[parts[0]] !== "object") {
          nested[parts[0]] = {};
        }
      }
      (nested[parts[0]] as Record<string, unknown>)[parts[1]] = value;
    } else {
      nested[key] = value;
    }
  }
  return nested;
}

/**
 * Fill a DOCX template with data and return the resulting DOCX buffer.
 *
 * Supports:
 * - Simple placeholders: {{mandant.name}}
 * - Conditional sections: {{#if condition}}...{{/if}} via docxtemplater truthy/falsy
 * - Inverted conditionals: {{^condition}}...{{/condition}} (shows when falsy)
 * - Loops: {{#items}}...{{/items}} for arrays
 * - Custom fields merged into the data object
 *
 * docxtemplater natively supports conditionals via {#key}...{/key} and {^key}...{/key},
 * and loops for arrays. We configure it with paragraphLoop and linebreaks for robust
 * multi-paragraph conditional blocks and line break preservation.
 */
export function fillDocxTemplate(
  docxBuffer: Buffer,
  data: Record<string, unknown>,
  customFelderValues?: Record<string, string>
): Buffer {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  // Merge custom field values into the data
  const mergedData: Record<string, unknown> = { ...data };
  if (customFelderValues) {
    for (const [key, value] of Object.entries(customFelderValues)) {
      mergedData[key] = value;
    }
  }

  // Convert dotted keys to nested object for docxtemplater
  const nestedData = toNestedData(mergedData);

  doc.render(nestedData);

  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf;
}
