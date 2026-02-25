import { randomUUID } from "crypto";
import { generateText } from "ai";
import { prisma } from "@/lib/db";
import { getModel, getProviderName, getModelName, getHelenaUserId } from "./provider";
import { wrapWithTracking } from "./token-tracker";
import {
  type AiAction,
  type PromptTemplateInput,
  buildPrompt,
  tagToAction,
  actionLabel,
} from "./prompt-templates";

/**
 * ProcessTaggedTasks -- Core AI task processing logic.
 *
 * Workflow:
 * 1. Fetch open tickets with ai:* tags (due today or overdue)
 * 2. Acquire lock (atomic updateMany with WHERE aiLockedAt IS NULL)
 * 3. For each locked task, determine action from ai: tag type
 * 4. Load case context
 * 5. Call AI provider via AI SDK to generate content
 * 6. Write result as draft/note (ChatNachricht, userId=Helena, erstelltDurch='ai')
 * 7. Mark task as completed (add ai:done tag) + release lock
 *
 * Security: NEVER sends emails/beA, NEVER sets document status to freigegeben/versendet.
 * All AI output is ENTWURF status only.
 */

/** Stale lock threshold: locks older than this are considered abandoned. */
const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes

interface ProcessResult {
  taskId: string;
  akteId: string | null;
  action: string;
  success: boolean;
  error?: string;
}

/**
 * Try to acquire a lock on a ticket for AI processing.
 * Uses atomic updateMany with WHERE condition to prevent races.
 * Returns true if lock was acquired, false if already locked.
 */
async function acquireLock(
  ticketId: string,
  runnerId: string
): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - LOCK_STALE_MS);

  // Atomic: only update if unlocked OR lock is stale
  const result = await prisma.ticket.updateMany({
    where: {
      id: ticketId,
      OR: [
        { aiLockedAt: null },
        { aiLockedAt: { lt: staleThreshold } },
      ],
    },
    data: {
      aiLockedAt: new Date(),
      aiLockedBy: runnerId,
    },
  });

  return result.count > 0;
}

/**
 * Release the lock on a ticket after processing.
 */
async function releaseLock(ticketId: string): Promise<void> {
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      aiLockedAt: null,
      aiLockedBy: null,
    },
  });
}

/**
 * Process all pending ai:-tagged tasks.
 * Returns an array of results for each processed task.
 */
export async function processTaggedTasks(): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const runnerId = `runner-${randomUUID().slice(0, 8)}`;

  // Find open tasks with ai: tags, due today or earlier
  const now = new Date();
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["OFFEN", "IN_BEARBEITUNG"] },
      OR: [{ faelligAm: { lte: now } }, { faelligAm: null }],
    },
    include: {
      akte: {
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          wegen: true,
          sachgebiet: true,
          notizen: true,
        },
      },
    },
    orderBy: [{ prioritaet: "desc" }, { faelligAm: "asc" }],
    take: 20, // Process max 20 tasks per run to avoid overload
  });

  // Filter to only ai:-tagged tasks
  const aiTickets = tickets.filter((t) =>
    t.tags.some((tag) => tag.startsWith("ai:"))
  );

  for (const ticket of aiTickets) {
    // Skip already-done tasks
    if (ticket.tags.includes("ai:done")) continue;

    // Try to acquire lock -- skip if another runner has it
    const locked = await acquireLock(ticket.id, runnerId);
    if (!locked) continue;

    try {
      // Mark as in progress
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "IN_BEARBEITUNG" },
      });

      const result = await processOneTask(ticket);
      results.push(result);

      // Lock is released implicitly: processOneTask sets ERLEDIGT + clears lock
    } catch (error: any) {
      // Release lock on failure so it can be retried
      await releaseLock(ticket.id).catch(() => {});

      results.push({
        taskId: ticket.id,
        akteId: ticket.akteId,
        action: "error",
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

async function processOneTask(ticket: any): Promise<ProcessResult> {
  const aiTags = ticket.tags.filter((t: string) => t.startsWith("ai:"));
  const primaryTag = aiTags[0]; // Use first ai: tag as action

  // Resolve action from tag -- fallback to "summary" for unknown ai: tags
  const action: AiAction = tagToAction(primaryTag) ?? "summary";

  // Load case context if linked to a case
  const caseContext = ticket.akteId && ticket.akte
    ? await buildCaseContext(ticket.akteId, ticket.akte)
    : "";

  // Build prompt from central templates
  const input: PromptTemplateInput = {
    titel: ticket.titel,
    beschreibung: ticket.beschreibung,
    caseContext,
  };
  const template = buildPrompt(action, input);

  // Call AI provider via AI SDK
  const model = await getModel();
  const providerName = await getProviderName();
  const modelName = await getModelName();

  const result = await generateText({
    model,
    prompt: template.prompt,
    system: template.system,
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  });

  const generatedContent = result.text;

  // Track token usage with Helena's user ID
  const helenaUserId = await getHelenaUserId();

  if (helenaUserId) {
    await wrapWithTracking(result, {
      userId: helenaUserId,
      akteId: ticket.akteId,
      funktion: "SCAN",
      provider: providerName,
      model: modelName,
    });
  }

  // Write result as ChatNachricht with Helena as author
  if (ticket.akteId) {
    await prisma.chatNachricht.create({
      data: {
        akteId: ticket.akteId,
        userId: helenaUserId, // Helena bot user (not null)
        nachricht: `[AI-${actionLabel(action)}: ${ticket.titel}]\n\n${generatedContent}`,
      },
    });
  }

  // Mark task as done + release lock in one update
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "ERLEDIGT",
      erledigtAm: new Date(),
      tags: Array.from(new Set([...ticket.tags, "ai:done"])),
      aiLockedAt: null,
      aiLockedBy: null,
    },
  });

  // Audit log with Helena as actor
  await prisma.auditLog.create({
    data: {
      userId: helenaUserId,
      akteId: ticket.akteId,
      aktion: "AI_TASK_AKTUALISIERT",
      details: {
        ticketId: ticket.id,
        action,
        tag: primaryTag,
        source: "process-tagged-tasks",
        provider: providerName,
        model: modelName,
        erstelltDurch: "ai",
      },
    },
  });

  return {
    taskId: ticket.id,
    akteId: ticket.akteId,
    action,
    success: true,
  };
}

async function buildCaseContext(
  akteId: string,
  akte: any
): Promise<string> {
  let ctx = `Akte: ${akte.aktenzeichen} -- ${akte.kurzrubrum}`;
  if (akte.wegen) ctx += `\nWegen: ${akte.wegen}`;
  if (akte.sachgebiet) ctx += `\nSachgebiet: ${akte.sachgebiet}`;
  if (akte.notizen) ctx += `\nNotizen: ${akte.notizen}`;

  // Load recent documents for additional context
  const docs = await prisma.dokument.findMany({
    where: { akteId },
    select: { name: true, ocrText: true, tags: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (docs.length > 0) {
    ctx += "\n\nDokumente in der Akte:\n";
    for (const doc of docs) {
      ctx += `- ${doc.name}`;
      if (doc.ocrText) {
        const truncated =
          doc.ocrText.length > 2000
            ? doc.ocrText.substring(0, 2000) + "..."
            : doc.ocrText;
        ctx += `\n  Inhalt: ${truncated}`;
      }
      ctx += "\n";
    }
  }

  // Load parties
  const beteiligte = await prisma.beteiligter.findMany({
    where: { akteId },
    include: {
      kontakt: {
        select: { nachname: true, vorname: true, firma: true, typ: true },
      },
    },
  });

  if (beteiligte.length > 0) {
    ctx += "\nBeteiligte:\n";
    for (const b of beteiligte) {
      const name =
        b.kontakt.typ === "JURISTISCH"
          ? b.kontakt.firma
          : `${b.kontakt.vorname ?? ""} ${b.kontakt.nachname ?? ""}`.trim();
      ctx += `- ${b.rolle}: ${name}\n`;
    }
  }

  return ctx;
}
