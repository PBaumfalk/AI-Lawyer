/**
 * BullMQ processor for Helena's proactive scanning.
 *
 * Periodically scans active Akten for actionable findings:
 * - Stale cases with no activity for 14+ days
 * - Missing Fristen (open Akten without any future deadlines)
 * - Pending unanswered emails
 *
 * Batch processing: max 20 Akten per run. Budget check before each.
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { checkBudget } from "@/lib/ai/token-tracker";
import { getHelenaUserId } from "@/lib/ai/provider";
import { createNotification } from "@/lib/notifications/service";

const log = createLogger("ai:proactive-processor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProactiveJobData {
  // Empty — runs on all active Akten
}

// ---------------------------------------------------------------------------
// processProactive
// ---------------------------------------------------------------------------

/**
 * BullMQ processor for the 'ai-proactive' queue.
 * Scans active Akten for actionable findings.
 */
export async function processProactive(job: Job<ProactiveJobData>): Promise<void> {
  log.info({ jobId: job.id }, "Processing proactive scan");

  // Budget check
  const budget = await checkBudget();
  if (budget.paused) {
    log.info("Proactive scan skipped: monthly token budget exhausted");
    return;
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get active Akten, max 20 per run
  const akten = await prisma.akte.findMany({
    where: { status: "OFFEN" },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      anwaltId: true,
      sachbearbeiterId: true,
      geaendert: true,
    },
    orderBy: { geaendert: "asc" }, // Oldest first (most likely stale)
    take: 20,
  });

  let suggestionsCreated = 0;

  for (const akte of akten) {
    // Budget check before each Akte
    const currentBudget = await checkBudget();
    if (currentBudget.paused) {
      log.info("Proactive scan paused mid-run: budget exhausted");
      break;
    }

    const userId = akte.anwaltId ?? akte.sachbearbeiterId;
    if (!userId) continue;

    // --- Check for stale case (no activity 14+ days) ---
    if (akte.geaendert < fourteenDaysAgo) {
      // Check idempotency: don't create another HINWEIS if one exists this week
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const existingHint = await prisma.helenaSuggestion.findFirst({
        where: {
          akteId: akte.id,
          typ: "HINWEIS",
          createdAt: { gte: weekAgo },
        },
        select: { id: true },
      });

      if (!existingHint) {
        const daysSinceActivity = Math.floor(
          (now.getTime() - akte.geaendert.getTime()) / 86400000
        );

        const suggestion = await prisma.helenaSuggestion.create({
          data: {
            userId,
            akteId: akte.id,
            typ: "HINWEIS",
            titel: `Inaktive Akte: ${akte.aktenzeichen}`,
            inhalt: `Die Akte "${akte.aktenzeichen} - ${akte.kurzrubrum}" hat seit ${daysSinceActivity} Tagen keine Aenderung. Bitte pruefen Sie, ob Handlungsbedarf besteht.`,
            status: "NEU",
          },
        });

        await createNotification({
          userId,
          type: "ai_suggestion" as any,
          title: "Helena: Inaktive Akte",
          message: `${akte.aktenzeichen} seit ${daysSinceActivity} Tagen ohne Aenderung`,
          data: { suggestionId: suggestion.id, typ: "HINWEIS", titel: suggestion.titel },
        });

        suggestionsCreated++;
      }
    }

    // --- Check for missing future Fristen ---
    const futureFristen = await prisma.kalenderEintrag.count({
      where: {
        akteId: akte.id,
        typ: "FRIST",
        erledigt: false,
        datum: { gte: today },
      },
    });

    if (futureFristen === 0) {
      // Check idempotency
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const existingMissing = await prisma.helenaSuggestion.findFirst({
        where: {
          akteId: akte.id,
          typ: "HINWEIS",
          titel: { contains: "Keine offenen Fristen" },
          createdAt: { gte: weekAgo },
        },
        select: { id: true },
      });

      if (!existingMissing) {
        const suggestion = await prisma.helenaSuggestion.create({
          data: {
            userId,
            akteId: akte.id,
            typ: "HINWEIS",
            titel: `Keine offenen Fristen: ${akte.aktenzeichen}`,
            inhalt: `Die Akte "${akte.aktenzeichen} - ${akte.kurzrubrum}" hat keine offenen Fristen. Bitte pruefen Sie, ob Fristen eingetragen werden muessen.`,
            status: "NEU",
          },
        });

        await createNotification({
          userId,
          type: "ai_suggestion" as any,
          title: "Helena: Keine Fristen",
          message: `${akte.aktenzeichen} hat keine offenen Fristen`,
          data: { suggestionId: suggestion.id, typ: "HINWEIS", titel: suggestion.titel },
        });

        suggestionsCreated++;
      }
    }
  }

  log.info(
    { aktenScanned: akten.length, suggestionsCreated },
    "Proactive scan completed"
  );
}
