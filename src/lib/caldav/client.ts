/**
 * tsdav wrapper for CalDAV operations.
 * Supports Google Calendar (OAuth2) and Apple iCloud Calendar (app-specific password).
 */

import { DAVClient, DAVCalendar } from "tsdav";
import { createLogger } from "@/lib/logger";
import type { CalDavProvider, CalDavCalendarInfo, CalDavEvent } from "./types";

const log = createLogger("caldav");

// ─── Client Creation ────────────────────────────────────────────────────────

export interface CalDavCredentials {
  username: string;
  password?: string;
  oauthTokens?: { accessToken: string };
}

/**
 * Create and authenticate a DAVClient for the given provider.
 */
export async function createCalDavClient(
  provider: CalDavProvider,
  serverUrl: string,
  credentials: CalDavCredentials
): Promise<DAVClient> {
  try {
    if (provider === "GOOGLE") {
      if (!credentials.oauthTokens?.accessToken) {
        throw new Error("OAuth2 Access-Token fuer Google Calendar erforderlich");
      }

      const client = new DAVClient({
        serverUrl,
        credentials: {
          tokenUrl: "https://oauth2.googleapis.com/token",
          accessToken: credentials.oauthTokens.accessToken,
          refreshToken: "",
          expiration: Date.now() + 3600000,
        },
        authMethod: "Oauth",
        defaultAccountType: "caldav",
      });

      await client.login();
      log.info({ provider, serverUrl }, "Google CalDAV client connected");
      return client;
    }

    // APPLE -- Basic auth with app-specific password
    if (!credentials.password) {
      throw new Error("App-spezifisches Passwort fuer Apple iCloud Calendar erforderlich");
    }

    const client = new DAVClient({
      serverUrl,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    await client.login();
    log.info({ provider, serverUrl }, "Apple CalDAV client connected");
    return client;
  } catch (error) {
    log.error({ provider, serverUrl, error }, "CalDAV client connection failed");
    throw error;
  }
}

// ─── Calendar Operations ────────────────────────────────────────────────────

/**
 * Fetch available calendars from the connected CalDAV account.
 */
export async function fetchCalendars(
  client: DAVClient
): Promise<CalDavCalendarInfo[]> {
  try {
    const calendars: DAVCalendar[] = await client.fetchCalendars();

    return calendars.map((cal) => ({
      url: cal.url,
      displayName:
        typeof cal.displayName === "string"
          ? cal.displayName
          : cal.displayName
            ? String(Object.values(cal.displayName)[0] ?? "Unbenannt")
            : "Unbenannt",
      ctag: cal.ctag,
      color: cal.calendarColor ?? undefined,
    }));
  } catch (error) {
    log.error({ error }, "Failed to fetch calendars");
    throw error;
  }
}

/**
 * Fetch calendar events (objects) from a specific calendar URL.
 */
export async function fetchEvents(
  client: DAVClient,
  calendarUrl: string,
  _options?: { ctag?: string }
): Promise<{ events: CalDavEvent[]; ctag: string }> {
  try {
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl } as DAVCalendar,
    });

    const events: CalDavEvent[] = [];

    for (const obj of objects) {
      if (!obj.data) continue;

      const parsed = parseVEvent(obj.data);
      if (parsed) {
        events.push({
          ...parsed,
          etag: obj.etag,
          url: obj.url,
        });
      }
    }

    // Fetch calendar ctag
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find((c) => c.url === calendarUrl);
    const ctag = calendar?.ctag ?? "";

    return { events, ctag };
  } catch (error) {
    log.error({ calendarUrl, error }, "Failed to fetch events");
    throw error;
  }
}

/**
 * Create a new calendar event.
 */
export async function createEvent(
  client: DAVClient,
  calendarUrl: string,
  event: CalDavEvent
): Promise<{ uid: string; etag: string }> {
  try {
    const uid = event.uid || generateUid();
    const iCalString = buildICalString({ ...event, uid });

    const response = await client.createCalendarObject({
      calendar: { url: calendarUrl } as DAVCalendar,
      iCalString,
      filename: `${uid}.ics`,
    });

    const etag = response.headers?.get("etag") ?? "";

    log.info({ uid, calendarUrl }, "CalDAV event created");
    return { uid, etag };
  } catch (error) {
    log.error({ calendarUrl, event: event.summary, error }, "Failed to create event");
    throw error;
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent(
  client: DAVClient,
  _calendarUrl: string,
  eventUrl: string,
  event: CalDavEvent,
  etag: string
): Promise<{ etag: string }> {
  try {
    const iCalString = buildICalString(event);

    const response = await client.updateCalendarObject({
      calendarObject: {
        url: eventUrl,
        data: iCalString,
        etag,
      },
    });

    const newEtag = response.headers?.get("etag") ?? etag;

    log.info({ eventUrl }, "CalDAV event updated");
    return { etag: newEtag };
  } catch (error) {
    log.error({ eventUrl, error }, "Failed to update event");
    throw error;
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  client: DAVClient,
  eventUrl: string,
  etag: string
): Promise<void> {
  try {
    await client.deleteCalendarObject({
      calendarObject: {
        url: eventUrl,
        etag,
      },
    });

    log.info({ eventUrl }, "CalDAV event deleted");
  } catch (error) {
    log.error({ eventUrl, error }, "Failed to delete event");
    throw error;
  }
}

// ─── iCalendar Helpers ──────────────────────────────────────────────────────

function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}@ai-lawyer`;
}

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

function buildICalString(event: CalDavEvent): string {
  const dtstart = event.allDay
    ? `DTSTART;VALUE=DATE:${formatDateForICal(event.dtstart, true)}`
    : `DTSTART:${formatDateForICal(event.dtstart, false)}`;

  let dtend = "";
  if (event.dtend) {
    dtend = event.allDay
      ? `DTEND;VALUE=DATE:${formatDateForICal(event.dtend, true)}`
      : `DTEND:${formatDateForICal(event.dtend, false)}`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI-Lawyer//CalDAV Sync//DE",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    dtstart,
    ...(dtend ? [dtend] : []),
    `SUMMARY:${escapeICalText(event.summary)}`,
    ...(event.description
      ? [`DESCRIPTION:${escapeICalText(event.description)}`]
      : []),
    `DTSTAMP:${formatDateForICal(new Date(), false)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Parse a VEVENT from iCalendar data into a CalDavEvent.
 */
function parseVEvent(icalData: string): Omit<CalDavEvent, "etag" | "url"> | null {
  try {
    const veventMatch = icalData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
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

function extractProp(vevent: string, prop: string): string | undefined {
  // Handle properties with parameters like DTSTART;VALUE=DATE:20260307
  const regex = new RegExp(`^${prop}[;:](.*)$`, "m");
  const match = vevent.match(regex);
  if (!match) return undefined;

  const value = match[1];
  // If there are parameters (e.g. ;VALUE=DATE:20260307), extract value after last ':'
  const colonIdx = value.lastIndexOf(":");
  if (colonIdx !== -1 && value.includes(";")) {
    // The match already started after PROP, so we have params;...:value or just value
    return value.substring(colonIdx + 1).trim();
  }
  return value.trim();
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseICalDate(value: string): Date {
  // Format: 20260307 (date only) or 20260307T120000Z (datetime)
  if (value.length === 8) {
    const y = parseInt(value.slice(0, 4), 10);
    const m = parseInt(value.slice(4, 6), 10) - 1;
    const d = parseInt(value.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d));
  }

  // Remove any trailing Z and parse
  const clean = value.replace(/Z$/, "");
  const y = parseInt(clean.slice(0, 4), 10);
  const mo = parseInt(clean.slice(4, 6), 10) - 1;
  const d = parseInt(clean.slice(6, 8), 10);
  const h = parseInt(clean.slice(9, 11), 10) || 0;
  const mi = parseInt(clean.slice(11, 13), 10) || 0;
  const s = parseInt(clean.slice(13, 15), 10) || 0;

  return new Date(Date.UTC(y, mo, d, h, mi, s));
}
