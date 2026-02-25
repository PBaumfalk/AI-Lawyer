/**
 * BullMQ processor for Helena's daily morning briefing.
 *
 * Generates a structured summary of today's due Fristen,
 * unanswered emails, and stale Akten.
 */

import type { Job } from "bullmq";
import { generateText } from "ai";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getModel, getProviderName, getModelName, getHelenaUserId } from "@/lib/ai/provider";
import { checkBudget, wrapWithTracking } from "@/lib/ai/token-tracker";
import { createNotification } from "@/lib/notifications/service";

const log = createLogger("ai:briefing-processor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingJobData {
  userId: string;
}

// ---------------------------------------------------------------------------
// processBriefing
// ---------------------------------------------------------------------------

/**
 * BullMQ processor for the 'ai-briefing' queue.
 * Generates a daily briefing for a specific user.
 */
export async function processBriefing(job: Job<BriefingJobData>): Promise<void> {
  const { userId } = job.data;

  log.info({ jobId: job.id, userId }, "Processing daily briefing");

  // Budget check
  const budget = await checkBudget();
  if (budget.paused) {
    log.info({ userId }, "Briefing skipped: monthly token budget exhausted");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Query today's due Fristen
  const dueFristen = await prisma.kalenderEintrag.findMany({
    where: {
      verantwortlichId: userId,
      typ: "FRIST",
      erledigt: false,
      datum: { gte: today, lt: tomorrow },
    },
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
    },
    orderBy: { datum: "asc" },
    take: 20,
  });

  // Query upcoming Fristen (next 7 days)
  const upcomingFristen = await prisma.kalenderEintrag.findMany({
    where: {
      verantwortlichId: userId,
      typ: "FRIST",
      erledigt: false,
      datum: { gte: tomorrow, lte: new Date(today.getTime() + 7 * 86400000) },
    },
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
    },
    orderBy: { datum: "asc" },
    take: 10,
  });

  // Query stale Akten (no activity in 7 days, status OFFEN)
  const staleAkten = await prisma.akte.findMany({
    where: {
      anwaltId: userId,
      status: "OFFEN",
      geaendert: { lt: sevenDaysAgo },
    },
    select: { aktenzeichen: true, kurzrubrum: true, geaendert: true },
    orderBy: { geaendert: "asc" },
    take: 10,
  });

  // Query today's new suggestions
  const newSuggestions = await prisma.helenaSuggestion.count({
    where: {
      userId,
      status: "NEU",
      createdAt: { gte: yesterday },
    },
  });

  // Build context for AI generation
  const fristenText = dueFristen.length > 0
    ? dueFristen
        .map(
          (f) =>
            `- ${f.titel} (${f.akte?.aktenzeichen ?? "Ohne Akte"}: ${f.akte?.kurzrubrum ?? ""}) - faellig ${f.datum.toLocaleDateString("de-DE")}`
        )
        .join("\n")
    : "Keine Fristen heute faellig.";

  const upcomingText = upcomingFristen.length > 0
    ? upcomingFristen
        .map(
          (f) =>
            `- ${f.titel} (${f.akte?.aktenzeichen ?? ""}) - faellig ${f.datum.toLocaleDateString("de-DE")}`
        )
        .join("\n")
    : "Keine anstehenden Fristen in den naechsten 7 Tagen.";

  const staleText = staleAkten.length > 0
    ? staleAkten
        .map(
          (a) =>
            `- ${a.aktenzeichen}: ${a.kurzrubrum} (letzte Aenderung: ${a.geaendert.toLocaleDateString("de-DE")})`
        )
        .join("\n")
    : "Keine inaktiven Akten.";

  const model = await getModel();
  const provider = await getProviderName();
  const modelName = await getModelName();
  const helenaId = await getHelenaUserId();

  const result = await generateText({
    model,
    system: `Du bist Helena, die digitale Rechtsanwaltsfachangestellte. Erstelle ein kurzes, uebersichtliches Tagesbriefing fuer den Anwalt.
Das Briefing soll strukturiert, sachlich und hilfreich sein. Verwende kurze Absaetze und Aufzaehlungszeichen.
Beginne mit einer freundlichen Begruessung und fasse dann die wichtigsten Punkte zusammen.`,
    prompt: `Datum: ${today.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}

HEUTIGE FRISTEN:
${fristenText}

ANSTEHENDE FRISTEN (naechste 7 Tage):
${upcomingText}

INAKTIVE AKTEN (keine Aenderung seit 7+ Tagen):
${staleText}

NEUE KI-VORSCHLAEGE: ${newSuggestions}

Erstelle ein kompaktes Tagesbriefing.`,
    maxTokens: 1000,
  });

  // Track tokens
  if (helenaId) {
    await wrapWithTracking(result, {
      userId: helenaId,
      akteId: null,
      funktion: "BRIEFING",
      provider,
      model: modelName,
    });
  }

  // Create HelenaSuggestion
  const suggestion = await prisma.helenaSuggestion.create({
    data: {
      userId,
      typ: "BRIEFING",
      titel: "Ihr Tagesbriefing",
      inhalt: result.text,
      status: "NEU",
    },
  });

  // Create notification
  await createNotification({
    userId,
    type: "ai_suggestion" as any,
    title: "Helena: Ihr Tagesbriefing",
    message: `${dueFristen.length} Fristen heute faellig, ${newSuggestions} neue Vorschlaege`,
    data: {
      suggestionId: suggestion.id,
      typ: "BRIEFING",
      titel: suggestion.titel,
      link: "/ki-chat?tab=vorschlaege",
    },
  });

  log.info(
    {
      userId,
      dueFristen: dueFristen.length,
      upcomingFristen: upcomingFristen.length,
      staleAkten: staleAkten.length,
    },
    "Daily briefing generated"
  );
}
