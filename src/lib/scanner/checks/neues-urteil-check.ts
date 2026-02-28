/**
 * NEUES_URTEIL cross-matching engine for SCAN-05.
 *
 * After Urteile RSS sync completes, matches newly ingested Urteile against
 * active Akten using pgvector cosine similarity with Sachgebiet pre-filtering.
 * Generates Helena briefings via LLM and creates NEUES_URTEIL alerts.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";
import { createScannerAlert, resolveAlertRecipients } from "../service";
import { assembleAkteSummaryText } from "../akte-embedding";
import { getModel } from "@/lib/ai/provider";
import { generateText } from "ai";
import { format } from "date-fns";
import type { AkteNorm, HelenaMemory } from "@prisma/client";

const log = createLogger("neues-urteil-check");

// ---------------------------------------------------------------------------
// Rechtsgebiet -> Sachgebiet mapping for pre-filtering
// ---------------------------------------------------------------------------

const RECHTSGEBIET_TO_SACHGEBIET: Record<string, string[]> = {
  Arbeitsrecht: ["ARBEITSRECHT"],
  Zivilrecht: [
    "FAMILIENRECHT",
    "MIETRECHT",
    "ERBRECHT",
    "HANDELSRECHT",
    "INKASSO",
    "VERKEHRSRECHT",
  ],
  Verwaltungsrecht: ["VERWALTUNGSRECHT"],
  Steuerrecht: ["SONSTIGES"],
  Sozialrecht: ["SOZIALRECHT"],
  Patentrecht: ["SONSTIGES"],
  Verfassungsrecht: [], // Cross-cutting: no pre-filter, match all Akten
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map cosine similarity score to alert severity (1-10 scale). */
function scoreToSeverity(score: number): number {
  if (score >= 0.9) return 9;
  if (score >= 0.85) return 8;
  if (score >= 0.8) return 7;
  if (score >= 0.75) return 6;
  return 5;
}

interface BriefingParams {
  urteilContent: string;
  gericht: string;
  aktenzeichen: string;
  datum: string;
  akteSummaryText: string;
  kurzrubrum: string;
  sachgebiet: string;
  score: number;
}

/** Generate a structured Helena briefing explaining why the Urteil is relevant. */
async function generateBriefing(params: BriefingParams): Promise<string> {
  const fallback =
    "Automatische Analyse nicht verfuegbar. Bitte pruefen Sie das Urteil manuell.";

  try {
    const model = await getModel();
    const { text } = await generateText({
      model,
      maxTokens: 500,
      system: `Du bist Helena, die KI-Rechtsanwaltsfachangestellte. Erstelle eine kurze, professionelle Analyse in genau drei Abschnitten:

1. "Was wurde entschieden?" - 1-2 Saetze ueber das Urteil
2. "Warum relevant fuer diese Akte?" - 1-2 Saetze zur Verbindung
3. "Moegliche Auswirkungen" - 1-2 Saetze mit konkreten Handlungsempfehlungen

Antworte auf Deutsch. Sei praezise und fachlich. Verwende keine Markdown-Formatierung.`,
      prompt: `Analysiere die Relevanz dieses Urteils fuer die folgende Akte.

Urteil:
- Gericht: ${params.gericht}
- Aktenzeichen: ${params.aktenzeichen}
- Datum: ${params.datum}
- Inhalt: ${params.urteilContent.slice(0, 2000)}

Akte:
- Kurzrubrum: ${params.kurzrubrum}
- Sachgebiet: ${params.sachgebiet}
- Aehnlichkeitsscore: ${(params.score * 100).toFixed(1)}%
- Kontext: ${params.akteSummaryText.slice(0, 1500)}`,
    });

    return text || fallback;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : err },
      "LLM briefing generation failed, using fallback"
    );
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Main cross-matching check
// ---------------------------------------------------------------------------

interface MatchRow {
  akteId: string;
  kurzrubrum: string;
  anwaltId: string | null;
  sachbearbeiterId: string | null;
  sachgebiet: string;
  score: number;
}

/**
 * Cross-match newly ingested Urteile against active Akten using pgvector
 * cosine similarity with Sachgebiet pre-filtering. Creates NEUES_URTEIL
 * alerts with Helena-generated briefings for matches above threshold.
 */
export async function runNeuesUrteilCheck(): Promise<{
  matched: number;
  alerts: number;
  errors: number;
}> {
  // Check if Neu-Urteil matching is enabled
  const enabled = await getSettingTyped<boolean>(
    "scanner.neues_urteil_enabled",
    true
  );
  if (!enabled) {
    log.info("Neu-Urteil check disabled via setting");
    return { matched: 0, alerts: 0, errors: 0 };
  }

  // Read threshold
  const threshold = await getSettingTyped<number>(
    "scanner.neues_urteil_threshold",
    0.72
  );

  // Find newly ingested Urteile (last 24h, PII-filtered, with embedding)
  const newUrteile = await prisma.$queryRaw<
    Array<{
      id: string;
      aktenzeichen: string;
      gericht: string;
      datum: Date;
      rechtsgebiet: string | null;
      content: string;
      sourceUrl: string;
    }>
  >`
    SELECT id, aktenzeichen, gericht, datum, rechtsgebiet, content, "sourceUrl"
    FROM urteil_chunks
    WHERE "ingestedAt" >= NOW() - INTERVAL '1 day'
      AND "piiFiltered" = true
      AND embedding IS NOT NULL
  `;

  if (newUrteile.length === 0) {
    log.info("No new Urteile to match");
    return { matched: 0, alerts: 0, errors: 0 };
  }

  log.info({ count: newUrteile.length }, "Found new Urteile for cross-matching");

  let matched = 0;
  let alerts = 0;
  let errors = 0;

  // Cache for assembled Akte summary texts (avoid re-fetching same Akte)
  const akteSummaryCache = new Map<string, string>();

  for (const urteil of newUrteile) {
    try {
      // Determine Sachgebiet filter
      const sachgebiete = urteil.rechtsgebiet
        ? RECHTSGEBIET_TO_SACHGEBIET[urteil.rechtsgebiet]
        : undefined;

      // Build cosine similarity query with optional Sachgebiet pre-filter
      let matches: MatchRow[];

      if (sachgebiete && sachgebiete.length > 0) {
        matches = await prisma.$queryRaw<MatchRow[]>`
          SELECT a.id AS "akteId", a.kurzrubrum, a."anwaltId", a."sachbearbeiterId", a.sachgebiet,
                 1 - (a."summaryEmbedding" <=> uc.embedding) AS score
          FROM akten a
          INNER JOIN urteil_chunks uc ON uc.id = ${urteil.id}
          WHERE a.status = 'OFFEN'
            AND a."summaryEmbedding" IS NOT NULL
            AND a.sachgebiet = ANY(${sachgebiete}::text[])
            AND 1 - (a."summaryEmbedding" <=> uc.embedding) >= ${threshold}
          ORDER BY score DESC
        `;
      } else {
        // No Sachgebiet filter (Verfassungsrecht or unknown rechtsgebiet)
        matches = await prisma.$queryRaw<MatchRow[]>`
          SELECT a.id AS "akteId", a.kurzrubrum, a."anwaltId", a."sachbearbeiterId", a.sachgebiet,
                 1 - (a."summaryEmbedding" <=> uc.embedding) AS score
          FROM akten a
          INNER JOIN urteil_chunks uc ON uc.id = ${urteil.id}
          WHERE a.status = 'OFFEN'
            AND a."summaryEmbedding" IS NOT NULL
            AND 1 - (a."summaryEmbedding" <=> uc.embedding) >= ${threshold}
          ORDER BY score DESC
        `;
      }

      if (matches.length === 0) continue;

      matched += matches.length;
      log.info(
        { urteilId: urteil.id, aktenzeichen: urteil.aktenzeichen, matchCount: matches.length },
        "Urteil matched against Akten"
      );

      for (const match of matches) {
        try {
          // Per-Urteil dedup: check if alert already exists for this Urteil-Akte pair
          const existingAlert = await prisma.helenaAlert.findFirst({
            where: {
              akteId: match.akteId,
              typ: "NEUES_URTEIL",
              meta: { path: ["urteilChunkId"], equals: urteil.id },
            },
          });

          if (existingAlert) {
            log.debug(
              { akteId: match.akteId, urteilId: urteil.id },
              "Alert already exists for this Urteil-Akte pair, skipping"
            );
            continue;
          }

          // Resolve alert recipients
          const recipients = await resolveAlertRecipients({
            anwaltId: match.anwaltId,
            sachbearbeiterId: match.sachbearbeiterId,
          });

          if (recipients.length === 0) continue;

          // Assemble Akte summary text (cached)
          let akteSummaryText = akteSummaryCache.get(match.akteId);
          if (!akteSummaryText) {
            const akteWithContext = await prisma.akte.findUnique({
              where: { id: match.akteId },
              include: { helenaMemory: true, normen: true },
            });

            if (akteWithContext) {
              akteSummaryText = assembleAkteSummaryText(
                akteWithContext as unknown as Parameters<typeof assembleAkteSummaryText>[0]
              );
              akteSummaryCache.set(match.akteId, akteSummaryText);
            } else {
              akteSummaryText = `${match.sachgebiet} - ${match.kurzrubrum}`;
            }
          }

          // Generate Helena briefing
          const briefing = await generateBriefing({
            urteilContent: urteil.content,
            gericht: urteil.gericht,
            aktenzeichen: urteil.aktenzeichen,
            datum: format(urteil.datum, "dd.MM.yyyy"),
            akteSummaryText,
            kurzrubrum: match.kurzrubrum,
            sachgebiet: match.sachgebiet,
            score: match.score,
          });

          // Create alert for each recipient
          for (const userId of recipients) {
            const alert = await createScannerAlert({
              akteId: match.akteId,
              userId,
              typ: "NEUES_URTEIL",
              titel: `Relevantes Urteil fuer ${match.kurzrubrum}`,
              inhalt: briefing,
              severity: scoreToSeverity(match.score),
              meta: {
                urteilChunkId: urteil.id,
                gericht: urteil.gericht,
                aktenzeichen: urteil.aktenzeichen,
                datum: format(urteil.datum, "dd.MM.yyyy"),
                sourceUrl: urteil.sourceUrl,
                score: match.score,
                rechtsgebiet: urteil.rechtsgebiet,
              },
            });

            if (alert) alerts++;
          }
        } catch (err) {
          errors++;
          log.warn(
            {
              akteId: match.akteId,
              urteilId: urteil.id,
              err: err instanceof Error ? err.message : err,
            },
            "Error processing match (per-match isolation)"
          );
        }
      }
    } catch (err) {
      errors++;
      log.error(
        {
          urteilId: urteil.id,
          err: err instanceof Error ? err.message : err,
        },
        "Error processing Urteil (per-Urteil isolation)"
      );
    }
  }

  log.info({ matched, alerts, errors }, "Neu-Urteil cross-matching summary");
  return { matched, alerts, errors };
}
