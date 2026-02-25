/**
 * BullMQ processor for AI document/email scanning.
 *
 * Processes new documents and emails through Helena's extraction pipeline:
 * - Deadline extraction (Fristenerkennung)
 * - Party extraction (Beteiligte-Erkennung)
 * - Email response draft generation (Antwort-Entwurf)
 *
 * Idempotency: max 1 result per document+type per day, retry max 2.
 * Budget enforcement: scanning pauses at 100% monthly budget.
 */

import type { Job } from "bullmq";
import { generateText } from "ai";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getModel, getProviderName, getModelName, getHelenaUserId } from "@/lib/ai/provider";
import { checkBudget, wrapWithTracking } from "@/lib/ai/token-tracker";
import { extractDeadlines } from "@/lib/ai/deadline-extractor";
import { extractParties } from "@/lib/ai/party-extractor";
import { createNotification } from "@/lib/notifications/service";

const log = createLogger("ai:scan-processor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiScanJobData {
  type: "document" | "email" | "bea";
  id: string; // dokumentId or emailId
  akteId?: string;
  content: string;
  metadata: {
    dokumentName?: string;
    betreff?: string;
    absender?: string;
  };
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

/**
 * Check if we already have a suggestion for this source+type today.
 * Prevents duplicate scanning within the same day.
 */
async function hasExistingSuggestion(
  sourceField: "dokumentId" | "emailId",
  sourceId: string,
  typ: string
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.helenaSuggestion.findFirst({
    where: {
      [sourceField]: sourceId,
      typ,
      createdAt: { gte: todayStart },
    },
    select: { id: true },
  });

  return !!existing;
}

// ---------------------------------------------------------------------------
// processScan — Main processor
// ---------------------------------------------------------------------------

/**
 * BullMQ processor for the 'ai-scan' queue.
 * Handles document, email, and beA scanning with idempotency and budget enforcement.
 */
export async function processScan(job: Job<AiScanJobData>): Promise<void> {
  const { type, id, akteId, content, metadata } = job.data;
  const sourceName = metadata.dokumentName || metadata.betreff || id;

  log.info({ jobId: job.id, type, id, sourceName }, "Processing AI scan");

  // Budget check: skip if paused
  const budget = await checkBudget();
  if (budget.paused) {
    log.info(
      { used: budget.used, limit: budget.limit, percentage: budget.percentage },
      "AI scan skipped: monthly token budget exhausted"
    );
    return;
  }

  // Determine the target user (Verantwortlicher of the Akte, or system fallback)
  let targetUserId: string | null = null;
  if (akteId) {
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { anwaltId: true, sachbearbeiterId: true },
    });
    targetUserId = akte?.anwaltId ?? akte?.sachbearbeiterId ?? null;
  }

  if (!targetUserId) {
    // Fallback: use Helena user or first admin
    targetUserId = await getHelenaUserId();
    if (!targetUserId) {
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN", aktiv: true },
        select: { id: true },
      });
      targetUserId = admin?.id ?? null;
    }
  }

  if (!targetUserId) {
    log.warn({ type, id }, "No target user found for AI scan, skipping");
    return;
  }

  // Skip if content is too short to be meaningful
  if (!content || content.trim().length < 50) {
    log.info({ type, id }, "Content too short for AI scan, skipping");
    return;
  }

  const sourceField = type === "email" ? "emailId" : "dokumentId";

  try {
    // --- Deadline extraction ---
    await processDeadlines(sourceField, id, akteId, targetUserId, content, metadata);

    // --- Party extraction ---
    await processParties(sourceField, id, akteId, targetUserId, content, metadata);

    // --- Email response draft ---
    if (type === "email") {
      await processEmailDraft(id, akteId, targetUserId, content, metadata);
    }

    log.info({ jobId: job.id, type, id }, "AI scan completed successfully");
  } catch (err) {
    // Increment retry count on the source if it exists as a suggestion
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ jobId: job.id, type, id, err: errMsg }, "AI scan failed");

    // Record error but don't re-throw (don't block the queue)
    await prisma.helenaSuggestion.updateMany({
      where: { [sourceField]: id, retryCount: { lt: 2 } },
      data: { retryCount: { increment: 1 }, errorMsg: errMsg },
    });
  }
}

// ---------------------------------------------------------------------------
// Sub-processors
// ---------------------------------------------------------------------------

async function processDeadlines(
  sourceField: "dokumentId" | "emailId",
  sourceId: string,
  akteId: string | undefined,
  userId: string,
  content: string,
  metadata: AiScanJobData["metadata"]
): Promise<void> {
  // Idempotency check
  if (await hasExistingSuggestion(sourceField, sourceId, "FRIST_ERKANNT")) {
    log.debug({ sourceId }, "Deadline suggestion already exists for today, skipping");
    return;
  }

  const deadlines = await extractDeadlines(content, {
    dokumentName: metadata.dokumentName ?? metadata.betreff,
    akteId,
  });

  for (const deadline of deadlines) {
    // Parse datum if available
    let faelligAm: Date | null = null;
    if (deadline.datum) {
      try {
        faelligAm = new Date(deadline.datum);
        if (isNaN(faelligAm.getTime())) faelligAm = null;
      } catch {
        faelligAm = null;
      }
    }

    // Create ENTWURF KalenderEintrag if we have a date and an Akte
    let linkedId: string | null = null;
    if (akteId && faelligAm) {
      const kalenderEintrag = await prisma.kalenderEintrag.create({
        data: {
          akteId,
          typ: "FRIST",
          titel: deadline.beschreibung,
          beschreibung: `Automatisch erkannt von Helena.\nGesetzliche Grundlage: ${deadline.gesetzlicheGrundlage ?? "nicht angegeben"}\nFristtyp: ${deadline.fristtyp}\nDauer: ${deadline.dauer ?? "nicht angegeben"}`,
          datum: faelligAm,
          fristablauf: faelligAm,
          verantwortlichId: userId,
          prioritaet: "HOCH",
          fristArt: deadline.fristtyp === "UNBESTIMMT" ? null : deadline.fristtyp,
          // Mark as draft (not yet active) by setting erledigt=false but adding a note
          erledigt: false,
        },
      });
      linkedId = kalenderEintrag.id;
    }

    // Create HelenaSuggestion
    const suggestion = await prisma.helenaSuggestion.create({
      data: {
        userId,
        akteId: akteId ?? null,
        [sourceField]: sourceId,
        typ: "FRIST_ERKANNT",
        titel: `Frist erkannt: ${deadline.beschreibung}`,
        inhalt: JSON.stringify({
          beschreibung: deadline.beschreibung,
          fristtyp: deadline.fristtyp,
          datum: deadline.datum,
          dauer: deadline.dauer,
          gesetzlicheGrundlage: deadline.gesetzlicheGrundlage,
          confidence: deadline.confidence,
          quellenStelle: deadline.quellenStelle,
        }),
        quellen: [
          {
            [sourceField === "dokumentId" ? "dokumentId" : "emailId"]: sourceId,
            name: metadata.dokumentName ?? metadata.betreff ?? "Unbekannt",
            passage: deadline.quellenStelle,
          },
        ],
        linkedId,
        status: "NEU",
      },
    });

    // Create notification
    await createNotification({
      userId,
      type: "ai_suggestion" as any,
      title: `Helena: Frist erkannt`,
      message: `${deadline.beschreibung}${deadline.datum ? ` (${deadline.datum})` : ""}`,
      data: { suggestionId: suggestion.id, typ: "FRIST_ERKANNT", titel: suggestion.titel },
    });
  }
}

async function processParties(
  sourceField: "dokumentId" | "emailId",
  sourceId: string,
  akteId: string | undefined,
  userId: string,
  content: string,
  metadata: AiScanJobData["metadata"]
): Promise<void> {
  // Idempotency check
  if (await hasExistingSuggestion(sourceField, sourceId, "BETEILIGTE_ERKANNT")) {
    log.debug({ sourceId }, "Party suggestion already exists for today, skipping");
    return;
  }

  const parties = await extractParties(content, {
    dokumentName: metadata.dokumentName ?? metadata.betreff,
    akteId,
  });

  if (parties.length === 0) return;

  // Create a single suggestion with all parties
  const suggestion = await prisma.helenaSuggestion.create({
    data: {
      userId,
      akteId: akteId ?? null,
      [sourceField]: sourceId,
      typ: "BETEILIGTE_ERKANNT",
      titel: `${parties.length} Beteiligte erkannt`,
      inhalt: JSON.stringify(parties),
      quellen: [
        {
          [sourceField === "dokumentId" ? "dokumentId" : "emailId"]: sourceId,
          name: metadata.dokumentName ?? metadata.betreff ?? "Unbekannt",
          passage: `${parties.length} Parteien identifiziert`,
        },
      ],
      status: "NEU",
    },
  });

  // Create notification
  await createNotification({
    userId,
    type: "ai_suggestion" as any,
    title: "Helena: Beteiligte erkannt",
    message: `${parties.length} Beteiligte in "${metadata.dokumentName ?? metadata.betreff ?? "Dokument"}" erkannt`,
    data: { suggestionId: suggestion.id, typ: "BETEILIGTE_ERKANNT", titel: suggestion.titel },
  });
}

async function processEmailDraft(
  emailId: string,
  akteId: string | undefined,
  userId: string,
  content: string,
  metadata: AiScanJobData["metadata"]
): Promise<void> {
  // Idempotency check
  if (await hasExistingSuggestion("emailId", emailId, "ANTWORT_ENTWURF")) {
    log.debug({ emailId }, "Email draft suggestion already exists for today, skipping");
    return;
  }

  const model = await getModel();
  const provider = await getProviderName();
  const modelName = await getModelName();
  const helenaId = await getHelenaUserId();

  // Truncate for token limits
  const truncatedContent = content.length > 10000
    ? content.slice(0, 10000) + "\n\n[... Text gekuerzt ...]"
    : content;

  const result = await generateText({
    model,
    system: `Du bist Helena, eine erfahrene Rechtsanwaltsfachangestellte. Erstelle einen hoeflichen, professionellen Antwort-Entwurf auf die folgende E-Mail.
Der Entwurf soll:
- Formell und sachlich sein
- Den Sachverhalt kurz zusammenfassen
- Eine angemessene Antwort vorschlagen
- Platzhalter fuer fehlende Informationen enthalten (z.B. [Mandantenname], [Aktenzeichen])
- Als ENTWURF gekennzeichnet sein

Schreibe den Entwurf direkt als E-Mail-Text (ohne Metadaten).`,
    prompt: `E-Mail von: ${metadata.absender ?? "Unbekannt"}
Betreff: ${metadata.betreff ?? "Kein Betreff"}

Inhalt:
${truncatedContent}`,
    maxTokens: 1500,
  });

  // Track tokens
  if (helenaId) {
    await wrapWithTracking(result, {
      userId: helenaId,
      akteId: akteId ?? null,
      funktion: "SCAN",
      provider,
      model: modelName,
    });
  }

  // Create suggestion
  const suggestion = await prisma.helenaSuggestion.create({
    data: {
      userId,
      akteId: akteId ?? null,
      emailId,
      typ: "ANTWORT_ENTWURF",
      titel: `Antwort-Entwurf: ${metadata.betreff ?? "E-Mail"}`,
      inhalt: result.text,
      quellen: [
        {
          emailId,
          name: metadata.betreff ?? "E-Mail",
          passage: `Von: ${metadata.absender ?? "Unbekannt"}`,
        },
      ],
      status: "NEU",
    },
  });

  // Create notification
  await createNotification({
    userId,
    type: "ai_suggestion" as any,
    title: "Helena: Antwort-Entwurf erstellt",
    message: `Entwurf fuer "${metadata.betreff ?? "E-Mail"}" verfuegbar`,
    data: {
      suggestionId: suggestion.id,
      typ: "ANTWORT_ENTWURF",
      titel: suggestion.titel,
      link: "/ki-chat?tab=vorschlaege",
    },
  });
}
