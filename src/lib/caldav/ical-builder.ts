/**
 * iCalendar VEVENT builder for KalenderEintrag <-> CalDAV conversion.
 * Builds VCALENDAR/VEVENT strings from internal KalenderEintrag fields,
 * and parses VEVENT strings back to CalDavEvent.
 *
 * No external iCal library -- events are simple (no RRULE per requirements).
 */

import type { CalDavEvent } from "./types";

// Minimal subset of KalenderEintrag fields needed for iCal building
export interface KalenderEintragForICal {
  id: string;
  typ: string; // KalenderTyp: TERMIN | FRIST | WIEDERVORLAGE | FOKUSZEIT
  titel: string;
  beschreibung?: string | null;
  datum: Date;
  datumBis?: Date | null;
  ganztaegig: boolean;
  updatedAt: Date;
}

// ─── Build iCalendar from KalenderEintrag ─────────────────────────────────

/**
 * Convert a KalenderEintrag to a full VCALENDAR/VEVENT iCalendar string.
 *
 * - Fristen: prepend "[FRIST] " to SUMMARY, set TRANSP:TRANSPARENT
 * - Termine: normal SUMMARY, set TRANSP:OPAQUE
 * - UID is deterministic: `${eintrag.id}@ai-lawyer.local`
 */
export function kalenderEintragToVEvent(eintrag: KalenderEintragForICal): string {
  const uid = `${eintrag.id}@ai-lawyer.local`;
  const isFrist = eintrag.typ === "FRIST";

  const summary = isFrist ? `[FRIST] ${eintrag.titel}` : eintrag.titel;
  const transp = isFrist ? "TRANSPARENT" : "OPAQUE";

  const dtstart = formatDateForICal(eintrag.datum, eintrag.ganztaegig);
  const dtstartLine = eintrag.ganztaegig
    ? `DTSTART;VALUE=DATE:${dtstart}`
    : `DTSTART:${dtstart}`;

  let dtendLine = "";
  if (eintrag.datumBis) {
    const dtend = formatDateForICal(eintrag.datumBis, eintrag.ganztaegig);
    dtendLine = eintrag.ganztaegig
      ? `DTEND;VALUE=DATE:${dtend}`
      : `DTEND:${dtend}`;
  }

  const dtstamp = formatDateForICal(eintrag.updatedAt, false);
  const lastModified = formatDateForICal(eintrag.updatedAt, false);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI-Lawyer//CalDAV Sync//DE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    dtstartLine,
    ...(dtendLine ? [dtendLine] : []),
    `SUMMARY:${escapeICalText(summary)}`,
    ...(eintrag.beschreibung
      ? [`DESCRIPTION:${escapeICalText(eintrag.beschreibung)}`]
      : []),
    `TRANSP:${transp}`,
    `DTSTAMP:${dtstamp}`,
    `LAST-MODIFIED:${lastModified}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

// ─── Parse iCalendar VEVENT to CalDavEvent ────────────────────────────────

/**
 * Parse a VEVENT iCalendar string to extract CalDavEvent fields.
 * Handles both DATE and DATE-TIME formats for all-day vs timed events.
 */
export function vEventToCalDavEvent(icalString: string): CalDavEvent | null {
  try {
    const veventMatch = icalString.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
    if (!veventMatch) return null;

    const vevent = veventMatch[0];

    const uid = extractProp(vevent, "UID");
    const summary = extractProp(vevent, "SUMMARY") ?? "Ohne Titel";
    const description = extractProp(vevent, "DESCRIPTION");
    const dtstart = extractProp(vevent, "DTSTART");
    const dtend = extractProp(vevent, "DTEND");

    if (!uid || !dtstart) return null;

    const allDay = vevent.includes("VALUE=DATE") && !vevent.includes("VALUE=DATE-TIME");

    return {
      uid,
      summary: unescapeICalText(summary),
      description: description ? unescapeICalText(description) : undefined,
      dtstart: parseICalDate(dtstart),
      dtend: dtend ? parseICalDate(dtend) : undefined,
      allDay,
    };
  } catch {
    return null;
  }
}

// ─── iCalendar Helpers ────────────────────────────────────────────────────

function formatDateForICal(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function extractProp(vevent: string, prop: string): string | undefined {
  // Handle properties with parameters like DTSTART;VALUE=DATE:20260307
  const regex = new RegExp(`^${prop}[;:](.*)$`, "m");
  const match = vevent.match(regex);
  if (!match) return undefined;

  const value = match[1];
  // If there are parameters (e.g. ;VALUE=DATE:20260307), extract value after last ':'
  const colonIdx = value.lastIndexOf(":");
  if (colonIdx !== -1 && value.includes(";")) {
    return value.substring(colonIdx + 1).trim();
  }
  return value.trim();
}

function parseICalDate(value: string): Date {
  // Format: 20260307 (date only) or 20260307T120000Z (datetime)
  if (value.length === 8) {
    const y = parseInt(value.slice(0, 4), 10);
    const m = parseInt(value.slice(4, 6), 10) - 1;
    const d = parseInt(value.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d));
  }

  const clean = value.replace(/Z$/, "");
  const y = parseInt(clean.slice(0, 4), 10);
  const mo = parseInt(clean.slice(4, 6), 10) - 1;
  const d = parseInt(clean.slice(6, 8), 10);
  const h = parseInt(clean.slice(9, 11), 10) || 0;
  const mi = parseInt(clean.slice(11, 13), 10) || 0;
  const s = parseInt(clean.slice(13, 15), 10) || 0;

  return new Date(Date.UTC(y, mo, d, h, mi, s));
}
