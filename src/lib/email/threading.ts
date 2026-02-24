/**
 * Email threading utilities.
 * Determines thread IDs from References/In-Reply-To headers.
 * Normalizes subjects by stripping reply/forward prefixes (including German).
 */

import { prisma } from "@/lib/db";

/**
 * Strip common reply/forward prefixes from an email subject.
 * Handles English (Re:, Fwd:) and German (AW:, WG:, Antwort:, Weiterleitung:) prefixes.
 * Strips multiple nested prefixes recursively.
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return "";

  // Pattern matches common prefix patterns (case-insensitive)
  // Re: Fwd: Fw: AW: WG: Antwort: Weiterleitung: Wtr: SV: VS:
  const prefixPattern = /^\s*(Re|Fwd?|AW|WG|Antwort|Weiterleitung|Wtr|SV|VS)\s*:\s*/i;

  let normalized = subject.trim();
  let previous = "";

  // Recursively strip prefixes until no more are found
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(prefixPattern, "").trim();
  }

  return normalized;
}

/**
 * Determine the thread ID for an email.
 *
 * Algorithm:
 * 1. Check References header (last entry = original message) -> look up threadId of that message
 * 2. Check In-Reply-To header -> look up threadId of that message
 * 3. Return null (new thread, will use own messageId as threadId)
 *
 * @param email - Object with messageId, inReplyTo, references
 * @returns threadId string or null for a new thread
 */
export async function findThreadId(email: {
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
}): Promise<string | null> {
  // Strategy 1: Check References header (most reliable for threading)
  if (email.references && email.references.length > 0) {
    // The first reference is typically the root message of the thread
    const rootRef = email.references[0];

    const existingMessage = await prisma.emailNachricht.findUnique({
      where: { messageId: rootRef },
      select: { threadId: true, messageId: true },
    });

    if (existingMessage) {
      return existingMessage.threadId ?? existingMessage.messageId;
    }

    // Try finding any message in the references chain
    const anyInThread = await prisma.emailNachricht.findFirst({
      where: { messageId: { in: email.references } },
      select: { threadId: true, messageId: true },
      orderBy: { empfangenAm: "asc" }, // earliest message = thread root
    });

    if (anyInThread) {
      return anyInThread.threadId ?? anyInThread.messageId;
    }
  }

  // Strategy 2: Check In-Reply-To header
  if (email.inReplyTo) {
    const parentMessage = await prisma.emailNachricht.findUnique({
      where: { messageId: email.inReplyTo },
      select: { threadId: true, messageId: true },
    });

    if (parentMessage) {
      return parentMessage.threadId ?? parentMessage.messageId;
    }
  }

  // No thread found - this is a new thread
  // The caller should use the email's own messageId as threadId
  return null;
}
