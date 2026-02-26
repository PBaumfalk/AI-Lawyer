/**
 * CSV contact import — parses CSV text and maps columns to Kontakt fields.
 * Supports ; and , delimiters and quoted fields.
 */

export interface CsvRow {
  [column: string]: string;
}

export interface ImportMapping {
  [csvColumn: string]: string; // maps CSV header → Kontakt field key
}

// Fields that can be imported
export const IMPORTABLE_FIELDS = [
  { key: "typ", label: "Typ (NATUERLICH/JURISTISCH)" },
  // Natural person
  { key: "anrede", label: "Anrede" },
  { key: "titel", label: "Titel" },
  { key: "vorname", label: "Vorname" },
  { key: "nachname", label: "Nachname" },
  { key: "geburtsdatum", label: "Geburtsdatum" },
  { key: "geburtsname", label: "Geburtsname" },
  { key: "geburtsort", label: "Geburtsort" },
  { key: "geburtsland", label: "Geburtsland" },
  { key: "familienstand", label: "Familienstand" },
  { key: "beruf", label: "Beruf" },
  { key: "branche", label: "Branche" },
  // Legal entity
  { key: "firma", label: "Firma" },
  { key: "rechtsform", label: "Rechtsform" },
  { key: "kurzname", label: "Kurzname" },
  { key: "registernummer", label: "Registernummer" },
  { key: "registergericht", label: "Registergericht" },
  // Address (legacy)
  { key: "strasse", label: "Straße" },
  { key: "plz", label: "PLZ" },
  { key: "ort", label: "Ort" },
  { key: "land", label: "Land" },
  // Communication
  { key: "telefon", label: "Telefon" },
  { key: "telefon2", label: "Telefon 2" },
  { key: "mobil", label: "Mobil" },
  { key: "fax", label: "Fax" },
  { key: "email", label: "E-Mail" },
  { key: "email2", label: "E-Mail 2" },
  { key: "website", label: "Website" },
  // Legal identifiers
  { key: "beaSafeId", label: "beA Safe-ID" },
  { key: "aktenzeichen", label: "Aktenzeichen (fremd)" },
  { key: "steuernr", label: "Steuernummer" },
  // Tax & Bank
  { key: "ustIdNr", label: "USt-IdNr." },
  { key: "finanzamt", label: "Finanzamt" },
  { key: "iban", label: "IBAN" },
  { key: "bic", label: "BIC" },
  { key: "kontoinhaber", label: "Kontoinhaber" },
  // Internal
  { key: "mandantennummer", label: "Mandantennummer" },
  { key: "akquisekanal", label: "Akquisekanal" },
  // Notes & tags
  { key: "notizen", label: "Notizen" },
  { key: "tags", label: "Tags (kommagetrennt)" },
] as const;

/**
 * Parse CSV text into rows. Auto-detects ; or , delimiter.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: use the one that produces more columns
  const semicolonCount = (lines[0].match(/;/g) ?? []).length;
  const commaCount = (lines[0].match(/,/g) ?? []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";

  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line, delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Auto-map CSV headers to Kontakt fields based on common patterns.
 */
export function autoMapHeaders(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};

  const patterns: [RegExp, string][] = [
    [/^(anrede|salutation|title_salutation)$/i, "anrede"],
    [/^(titel|title|academic.?title)$/i, "titel"],
    [/^(vorname|first.?name|given.?name|prename)$/i, "vorname"],
    [/^(nachname|last.?name|family.?name|surname|name)$/i, "nachname"],
    [/^(geburts.?datum|date.?of.?birth|birthday|dob)$/i, "geburtsdatum"],
    [/^(geburts.?name|birth.?name|maiden.?name)$/i, "geburtsname"],
    [/^(geburts.?ort|birth.?place|place.?of.?birth)$/i, "geburtsort"],
    [/^(geburts.?land|birth.?country|country.?of.?birth)$/i, "geburtsland"],
    [/^(familienstand|marital.?status)$/i, "familienstand"],
    [/^(beruf|profession|occupation|job)$/i, "beruf"],
    [/^(branche|industry|sector)$/i, "branche"],
    [/^(firma|company|organization|organisation|org)$/i, "firma"],
    [/^(rechtsform|legal.?form)$/i, "rechtsform"],
    [/^(kurz.?name|short.?name|abk)$/i, "kurzname"],
    [/^(register.?nummer|register.?number|hrb|hra)$/i, "registernummer"],
    [/^(register.?gericht|register.?court)$/i, "registergericht"],
    [/^(stra(ss|ß)e|street|address|adresse)$/i, "strasse"],
    [/^(plz|zip|postal.?code|postleitzahl)$/i, "plz"],
    [/^(ort|city|stadt|town)$/i, "ort"],
    [/^(land|country)$/i, "land"],
    [/^(telefon|phone|tel|telephone)$/i, "telefon"],
    [/^(telefon.?2|phone.?2)$/i, "telefon2"],
    [/^(mobil|mobile|cell|handy)$/i, "mobil"],
    [/^(fax)$/i, "fax"],
    [/^(e?.?mail|email.?address)$/i, "email"],
    [/^(e?.?mail.?2|email2)$/i, "email2"],
    [/^(website|web|url|homepage)$/i, "website"],
    [/^(bea.?safe.?id|bea.?id|safe.?id)$/i, "beaSafeId"],
    [/^(aktenzeichen|az|file.?ref|reference)$/i, "aktenzeichen"],
    [/^(steuer.?nr|steuer.?nummer|tax.?id|tax.?number)$/i, "steuernr"],
    [/^(ust.?id.?nr|vat.?id|vat.?number|ust.?id)$/i, "ustIdNr"],
    [/^(finanzamt|tax.?office)$/i, "finanzamt"],
    [/^(iban)$/i, "iban"],
    [/^(bic|swift)$/i, "bic"],
    [/^(konto.?inhaber|account.?holder)$/i, "kontoinhaber"],
    [/^(mandanten.?nummer|mandanten.?nr|client.?number|client.?id)$/i, "mandantennummer"],
    [/^(akquise.?kanal|acquisition|source)$/i, "akquisekanal"],
    [/^(notizen|notes|bemerkung)$/i, "notizen"],
    [/^(tags|labels|categories|kategorien)$/i, "tags"],
    [/^(typ|type|art)$/i, "typ"],
  ];

  for (const header of headers) {
    for (const [pattern, field] of patterns) {
      if (pattern.test(header)) {
        mapping[header] = field;
        break;
      }
    }
  }

  return mapping;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

/**
 * Transform a mapped CSV row into a Kontakt create payload.
 */
export function rowToKontakt(
  row: CsvRow,
  mapping: ImportMapping
): Record<string, any> | null {
  const data: Record<string, any> = {};

  for (const [csvCol, kontaktField] of Object.entries(mapping)) {
    if (!kontaktField || kontaktField === "_skip") continue;
    const value = row[csvCol]?.trim() ?? "";
    if (!value) continue;

    if (kontaktField === "tags") {
      data.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (kontaktField === "typ") {
      const upper = value.toUpperCase();
      if (upper.includes("JURIST") || upper.includes("FIRMA") || upper.includes("COMPANY")) {
        data.typ = "JURISTISCH";
      } else {
        data.typ = "NATUERLICH";
      }
    } else {
      data[kontaktField] = value;
    }
  }

  // Auto-detect type if not set
  if (!data.typ) {
    data.typ = data.firma ? "JURISTISCH" : "NATUERLICH";
  }

  // Validate minimum required fields
  if (data.typ === "NATUERLICH" && !data.nachname) return null;
  if (data.typ === "JURISTISCH" && !data.firma) return null;

  return data;
}
