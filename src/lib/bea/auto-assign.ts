/**
 * beA Auto-Assignment Logic (server-side)
 *
 * Attempts to automatically match a beA message to an Akte (case file)
 * using multiple matching strategies with confidence scoring.
 *
 * Matching strategies (in priority order):
 * 1. Aktenzeichen regex in betreff or inhalt -> SICHER
 * 2. SAFE-ID match via Kontakt.beaSafeId -> WAHRSCHEINLICH
 * 3. Court reference (Gerichtsaktenzeichen) matching -> WAHRSCHEINLICH
 *
 * When confidence is SICHER, auto-assign. When WAHRSCHEINLICH, suggest with
 * confirmation dialog. When UNSICHER, leave unassigned.
 */

import { prisma } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AutoAssignInput {
  betreff: string;
  absender: string;
  inhalt?: string | null;
  safeIdAbsender?: string | null;
}

export interface AutoAssignResult {
  akteId: string | null;
  confidence: "SICHER" | "WAHRSCHEINLICH" | "UNSICHER";
  reason: string;
}

// ─── Aktenzeichen Patterns ───────────────────────────────────────────────────

/**
 * Internal Aktenzeichen format: NNNNN/YY (e.g., 00001/26, 00123/25)
 */
const INTERNAL_AZ_PATTERN = /\b(\d{4,5}\/\d{2})\b/g;

/**
 * Court Aktenzeichen patterns (Gerichtsaktenzeichen):
 * - Civil: 1 O 123/25, 12 U 456/24
 * - Criminal: 1 Ks 23/25, 501 Js 12345/24
 * - Labor: 3 Ca 567/25
 * - Family: 312 F 89/25
 * - Administrative: 1 K 234/25
 */
const COURT_AZ_PATTERN = /\b(\d{1,3}\s+[A-Za-z]{1,4}\s+\d{1,6}\/\d{2,4})\b/g;

// ─── Matching Functions ──────────────────────────────────────────────────────

/**
 * Strategy 1: Match internal Aktenzeichen in message text.
 * Returns SICHER if exactly one Akte matches.
 */
async function matchByAktenzeichen(
  text: string
): Promise<AutoAssignResult | null> {
  const matches = text.match(INTERNAL_AZ_PATTERN);
  if (!matches || matches.length === 0) return null;

  // Deduplicate found Aktenzeichen
  const uniqueAz = Array.from(new Set(matches));

  // Look up Akten by Aktenzeichen
  const akten = await prisma.akte.findMany({
    where: {
      aktenzeichen: { in: uniqueAz },
      status: { not: "GESCHLOSSEN" },
    },
    select: { id: true, aktenzeichen: true, kurzrubrum: true },
  });

  if (akten.length === 1) {
    return {
      akteId: akten[0].id,
      confidence: "SICHER",
      reason: `Aktenzeichen ${akten[0].aktenzeichen} (${akten[0].kurzrubrum}) in Nachricht gefunden`,
    };
  }

  if (akten.length > 1) {
    // Multiple matches -- pick first but mark as WAHRSCHEINLICH
    return {
      akteId: akten[0].id,
      confidence: "WAHRSCHEINLICH",
      reason: `Mehrere Aktenzeichen gefunden: ${akten.map((a) => a.aktenzeichen).join(", ")}`,
    };
  }

  return null;
}

/**
 * Strategy 2: Match sender SAFE-ID to a Kontakt's beaSafeId, then find
 * Akten where that Kontakt is a Beteiligter.
 */
async function matchBySafeId(
  safeIdAbsender: string | null | undefined
): Promise<AutoAssignResult | null> {
  if (!safeIdAbsender) return null;

  // Find Kontakte with this SAFE-ID
  const kontakte = await prisma.kontakt.findMany({
    where: { beaSafeId: safeIdAbsender },
    select: {
      id: true,
      nachname: true,
      firma: true,
      beteiligte: {
        select: {
          akteId: true,
          rolle: true,
          akte: {
            select: {
              id: true,
              aktenzeichen: true,
              kurzrubrum: true,
              status: true,
            },
          },
        },
        where: {
          akte: { status: { not: "GESCHLOSSEN" } },
        },
      },
    },
  });

  if (kontakte.length === 0) return null;

  // Collect all active Akten linked to these Kontakte
  const activeAkten = kontakte.flatMap((k) =>
    k.beteiligte.map((b) => ({
      akteId: b.akteId,
      aktenzeichen: b.akte.aktenzeichen,
      kurzrubrum: b.akte.kurzrubrum,
      kontaktName: k.nachname || k.firma || "Unbekannt",
      rolle: b.rolle,
    }))
  );

  if (activeAkten.length === 0) return null;

  if (activeAkten.length === 1) {
    return {
      akteId: activeAkten[0].akteId,
      confidence: "WAHRSCHEINLICH",
      reason: `Absender-SAFE-ID gehoert zu ${activeAkten[0].kontaktName} (${activeAkten[0].rolle}) in Akte ${activeAkten[0].aktenzeichen}`,
    };
  }

  // Multiple Akten -- return first, mark as WAHRSCHEINLICH
  return {
    akteId: activeAkten[0].akteId,
    confidence: "WAHRSCHEINLICH",
    reason: `Absender-SAFE-ID verknuepft mit ${activeAkten.length} Akten: ${activeAkten.map((a) => a.aktenzeichen).join(", ")}`,
  };
}

/**
 * Strategy 3: Match court reference numbers (Gerichtsaktenzeichen) from
 * message text against Akte.falldaten court references.
 */
async function matchByCourtReference(
  text: string
): Promise<AutoAssignResult | null> {
  const matches = text.match(COURT_AZ_PATTERN);
  if (!matches || matches.length === 0) return null;

  // Normalize: remove extra spaces
  const normalizedMatches = matches.map((m) =>
    m.replace(/\s+/g, " ").trim()
  );
  const uniqueRefs = Array.from(new Set(normalizedMatches));

  // Search in Akte falldaten JSON for matching Gerichtsaktenzeichen
  // Also check the kurzrubrum field which sometimes contains court references
  const akten = await prisma.akte.findMany({
    where: {
      status: { not: "GESCHLOSSEN" },
    },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      falldaten: true,
    },
  });

  for (const ref of uniqueRefs) {
    const matchingAkten = akten.filter((akte) => {
      // Check falldaten JSON for gerichtsAktenzeichen
      if (akte.falldaten && typeof akte.falldaten === "object") {
        const fd = akte.falldaten as Record<string, unknown>;
        const gerichtsAz = fd.gerichtsAktenzeichen || fd.gerichtsaktenzeichen;
        if (typeof gerichtsAz === "string") {
          const normalizedGerichtsAz = gerichtsAz.replace(/\s+/g, " ").trim();
          if (normalizedGerichtsAz === ref) return true;
        }
      }

      // Check kurzrubrum for court reference
      if (akte.kurzrubrum && akte.kurzrubrum.includes(ref)) return true;

      return false;
    });

    if (matchingAkten.length === 1) {
      return {
        akteId: matchingAkten[0].id,
        confidence: "WAHRSCHEINLICH",
        reason: `Gerichtsaktenzeichen ${ref} passt zu Akte ${matchingAkten[0].aktenzeichen}`,
      };
    }
  }

  return null;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Attempts to auto-assign a beA message to an Akte.
 *
 * Applies matching strategies in priority order:
 * 1. Internal Aktenzeichen in text (SICHER)
 * 2. SAFE-ID of sender (WAHRSCHEINLICH)
 * 3. Court reference number (WAHRSCHEINLICH)
 *
 * Returns UNSICHER if no match found.
 */
export async function autoAssignToAkte(
  nachricht: AutoAssignInput
): Promise<AutoAssignResult> {
  const searchText = [nachricht.betreff, nachricht.inhalt || ""].join(" ");

  // Strategy 1: Internal Aktenzeichen
  const azMatch = await matchByAktenzeichen(searchText);
  if (azMatch) return azMatch;

  // Strategy 2: SAFE-ID
  const safeIdMatch = await matchBySafeId(nachricht.safeIdAbsender);
  if (safeIdMatch) return safeIdMatch;

  // Strategy 3: Court reference
  const courtMatch = await matchByCourtReference(searchText);
  if (courtMatch) return courtMatch;

  // No match found
  return {
    akteId: null,
    confidence: "UNSICHER",
    reason: "Keine automatische Zuordnung moeglich",
  };
}
