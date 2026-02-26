/**
 * vCard (.vcf) parser — parses vCard 3.0/4.0 files into Kontakt-compatible objects.
 */

export interface VCardContact {
  typ: "NATUERLICH" | "JURISTISCH";
  anrede?: string;
  titel?: string;
  vorname?: string;
  nachname?: string;
  geburtsdatum?: string;
  firma?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  telefon?: string;
  telefon2?: string;
  mobil?: string;
  fax?: string;
  email?: string;
  email2?: string;
  website?: string;
  notizen?: string;
}

/**
 * Parse a vCard file (may contain multiple vCards) into contact objects.
 */
export function parseVCards(text: string): VCardContact[] {
  const contacts: VCardContact[] = [];
  // Unfold long lines (RFC 6350: line folding with leading space/tab)
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const cards = unfolded.split(/(?=BEGIN:VCARD)/i);

  for (const card of cards) {
    const trimmed = card.trim();
    if (!trimmed.toUpperCase().startsWith("BEGIN:VCARD")) continue;

    const contact = parseOneVCard(trimmed);
    if (contact) contacts.push(contact);
  }

  return contacts;
}

function parseOneVCard(text: string): VCardContact | null {
  const lines = text.split("\n");
  const props: { key: string; params: string[]; value: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toUpperCase() === "BEGIN:VCARD" || trimmed.toUpperCase() === "END:VCARD") continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;

    const left = trimmed.substring(0, colonIdx);
    const value = trimmed.substring(colonIdx + 1);
    const parts = left.split(";");
    const key = parts[0].toUpperCase();
    const params = parts.slice(1).map((p) => p.toUpperCase());

    props.push({ key, params, value });
  }

  const contact: VCardContact = { typ: "NATUERLICH" };
  const phones: { type: string; value: string }[] = [];
  const emails: string[] = [];

  for (const { key, params, value } of props) {
    switch (key) {
      case "N": {
        // N:Last;First;Middle;Prefix;Suffix
        const [last, first, _middle, prefix] = value.split(";");
        contact.nachname = last || undefined;
        contact.vorname = first || undefined;
        if (prefix) contact.titel = prefix;
        break;
      }
      case "FN":
        // Full name — fallback if N is missing
        if (!contact.nachname && !contact.vorname) {
          const parts = value.trim().split(/\s+/);
          if (parts.length >= 2) {
            contact.vorname = parts.slice(0, -1).join(" ");
            contact.nachname = parts[parts.length - 1];
          } else {
            contact.nachname = value.trim();
          }
        }
        break;
      case "ORG":
        contact.firma = value.split(";")[0] || undefined;
        break;
      case "TITLE":
        // Job title → use as titel only if no academic title set
        if (!contact.titel) contact.titel = value || undefined;
        break;
      case "ADR": {
        // ADR:PO Box;Extended;Street;City;Region;Postal;Country
        const adr = value.split(";");
        contact.strasse = adr[2] || undefined;
        contact.ort = adr[3] || undefined;
        contact.plz = adr[5] || undefined;
        contact.land = adr[6] || undefined;
        break;
      }
      case "TEL": {
        const typeParam = params.find((p) => p.startsWith("TYPE="));
        const types = typeParam ? typeParam.replace("TYPE=", "").split(",") : [];
        phones.push({ type: types.join(","), value: value.replace(/[^\d+\-\s()]/g, "") });
        break;
      }
      case "EMAIL":
        emails.push(value.trim());
        break;
      case "URL":
        contact.website = value || undefined;
        break;
      case "BDAY":
        // Format: YYYY-MM-DD or YYYYMMDD
        contact.geburtsdatum = value.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
        break;
      case "NOTE":
        contact.notizen = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "X-GENDER":
      case "GENDER": {
        const g = value.toUpperCase();
        if (g.startsWith("M")) contact.anrede = "Herr";
        else if (g.startsWith("F")) contact.anrede = "Frau";
        break;
      }
    }
  }

  // Assign phones by type
  for (const phone of phones) {
    const t = phone.type.toUpperCase();
    if (t.includes("FAX")) {
      contact.fax = phone.value;
    } else if (t.includes("CELL") || t.includes("MOBILE")) {
      contact.mobil = phone.value;
    } else if (!contact.telefon) {
      contact.telefon = phone.value;
    } else if (!contact.telefon2) {
      contact.telefon2 = phone.value;
    }
  }

  // Assign emails
  if (emails[0]) contact.email = emails[0];
  if (emails[1]) contact.email2 = emails[1];

  // Determine type
  if (contact.firma && !contact.nachname) {
    contact.typ = "JURISTISCH";
  }

  // Validate minimum data
  if (!contact.nachname && !contact.firma) return null;

  return contact;
}
