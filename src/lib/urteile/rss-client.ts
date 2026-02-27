/**
 * BMJ RSS feed fetcher and XML parser for German federal court decisions.
 *
 * Fetches structured judgment data from rechtsprechung-im-internet.de RSS feeds
 * for 7 federal courts (BGH, BAG, BVerwG, BFH, BSG, BPatG, BVerfG).
 *
 * Title parsing uses a loose regex that handles BVerfG Kammerbeschluss,
 * Nichtannahmebeschluss, Gerichtsbescheid variants and any court-senat combination.
 */

import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * BMJ RSS feed URLs for all 7 federal courts (verified live 2026-02-27).
 */
export const BMJ_RSS_FEEDS: Record<string, string> = {
  BGH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bgh.xml",
  BAG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bag.xml",
  BVerwG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverwg.xml",
  BFH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bfh.xml",
  BSG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bsg.xml",
  BPatG:  "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bpatg.xml",
  BVerfG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverfg.xml",
};

/**
 * Maps court codes to their Rechtsgebiet for filtering and display.
 * Internal — not exported.
 */
const RECHTSGEBIET_MAP: Record<string, string> = {
  BAG:    "Arbeitsrecht",
  BGH:    "Zivilrecht",
  BVerwG: "Verwaltungsrecht",
  BFH:    "Steuerrecht",
  BSG:    "Sozialrecht",
  BPatG:  "Patentrecht",
  BVerfG: "Verfassungsrecht",
};

/**
 * Loose regex for RSS item titles. Matches any court header format including:
 * - "BGH 1. Senat, Urteil vom 12.01.2024, I ZR 234/23"
 * - "BVerfG 2. Kammer, Nichtannahmebeschluss vom 05.03.2024, 1 BvR 123/23"
 * - "BAG 7. Senat, Gerichtsbescheid vom 18.09.2024, 7 AZR 185/24"
 *
 * Capture groups:
 *   [1] = entscheidungstyp  (e.g. "Urteil", "Beschluss", "Nichtannahmebeschluss")
 *   [2] = day  (DD)
 *   [3] = month (MM)
 *   [4] = year  (YYYY)
 *   [5] = aktenzeichen (e.g. "7 AZR 185/24")
 */
const TITLE_REGEX = /^.+?,\s*(.+?)\s+vom\s+(\d{2})\.(\d{2})\.(\d{4}),\s+(.+)$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single judgment item parsed from a BMJ RSS feed.
 */
export interface UrteilRssItem {
  /** Unique identifier for idempotency — from RSS <guid> element */
  guid: string;
  /** Court code matching BMJ_RSS_FEEDS key, e.g. "BAG" */
  gericht: string;
  /** German court file reference, e.g. "7 AZR 185/24" */
  aktenzeichen: string;
  /** Date of the decision */
  datum: Date;
  /** Decision type, e.g. "Urteil", "Beschluss", "Nichtannahmebeschluss" */
  entscheidungstyp: string;
  /** Abstract/headnote — may be empty for BGH items that lack Leitsatz */
  leitsatz: string;
  /** Canonical URL to the full text on rechtsprechung-im-internet.de */
  sourceUrl: string;
  /** Legal subject area derived from court code */
  rechtsgebiet?: string;
}

// ---------------------------------------------------------------------------
// XMLParser configuration
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: true,
  // Force item to always be an array even when there is only one item
  isArray: (name) => name === "item",
});

// ---------------------------------------------------------------------------
// Feed fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch and parse the RSS feed for a given federal court.
 *
 * @param gerichtCode - One of the keys in BMJ_RSS_FEEDS (e.g. "BAG", "BGH")
 * @returns Array of UrteilRssItem — items that fail title parsing are silently skipped
 * @throws Error if the gerichtCode is unknown or the HTTP request fails/times out
 */
export async function fetchUrteileFeed(
  gerichtCode: string
): Promise<UrteilRssItem[]> {
  const url = BMJ_RSS_FEEDS[gerichtCode];
  if (!url) {
    throw new Error(
      `Unknown Gericht code "${gerichtCode}". Valid codes: ${Object.keys(BMJ_RSS_FEEDS).join(", ")}`
    );
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
  });

  if (!response.ok) {
    throw new Error(
      `BMJ RSS fetch failed for ${gerichtCode}: HTTP ${response.status}`
    );
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: Array<{
          title?: string;
          link?: string;
          guid?: string | { "#text": string };
          description?: string;
          pubDate?: string;
        }>;
      };
    };
  };

  const items = parsed?.rss?.channel?.item ?? [];
  const rechtsgebiet = RECHTSGEBIET_MAP[gerichtCode];

  return items.flatMap((item) => {
    try {
      // guid may be a plain string or an object with "#text" key
      const rawGuid = item.guid;
      const guid =
        typeof rawGuid === "string"
          ? rawGuid
          : typeof rawGuid === "object" && rawGuid !== null && "#text" in rawGuid
          ? rawGuid["#text"]
          : String(rawGuid ?? "");

      const title = item.title ?? "";
      const match = title.match(TITLE_REGEX);

      if (!match) {
        console.warn(
          `[rss-client] Title parse failed for ${gerichtCode} — skipping: "${title}"`
        );
        return [];
      }

      const [, entscheidungstyp, day, month, year, aktenzeichen] = match;
      const datum = new Date(
        Number(year),
        Number(month) - 1, // months are 0-indexed
        Number(day)
      );

      const sourceUrl = item.link ?? guid;
      const leitsatz = item.description ?? "";

      const result: UrteilRssItem = {
        guid,
        gericht: gerichtCode,
        aktenzeichen: aktenzeichen.trim(),
        datum,
        entscheidungstyp: entscheidungstyp.trim(),
        leitsatz,
        sourceUrl,
        rechtsgebiet,
      };

      return [result];
    } catch (err) {
      console.warn(
        `[rss-client] Failed to parse item for ${gerichtCode}:`,
        err
      );
      return [];
    }
  });
}
