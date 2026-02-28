/**
 * Helena Draft Activity Helper
 *
 * Creates an AktenActivity record (typ=HELENA_DRAFT) and emits a Socket.IO event
 * so that drafts appear in the chronological activity feed immediately.
 *
 * Fire-and-forget: errors are logged but never thrown.
 */

import type { ExtendedPrismaClient, PrismaTransactionClient } from "@/lib/db";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("draft-activity");

interface DraftActivityInput {
  akteId: string;
  draftId: string;
  draftTitel: string;
  draftInhalt: string;
  draftTyp: string;
}

/**
 * Create an AktenActivity entry for a Helena draft and emit a Socket.IO event.
 *
 * - `userId` is null (Helena attribution)
 * - `meta.draftStatus` is "PENDING" so inline review buttons render
 * - `inhalt` is truncated to 200 chars
 * - Errors are caught and logged (fire-and-forget)
 */
export async function createDraftActivity(
  prisma: ExtendedPrismaClient | PrismaTransactionClient,
  input: DraftActivityInput,
): Promise<void> {
  try {
    const activity = await prisma.aktenActivity.create({
      data: {
        akteId: input.akteId,
        userId: null,
        typ: "HELENA_DRAFT",
        titel: `Helena-Entwurf: ${input.draftTitel}`,
        inhalt: input.draftInhalt.slice(0, 200),
        meta: {
          draftId: input.draftId,
          draftStatus: "PENDING",
          draftTyp: input.draftTyp,
        },
      },
    });

    // Emit to akte room for live feed update
    getSocketEmitter()
      .to(`akte:${input.akteId}`)
      .emit("akten-activity:new", {
        id: activity.id,
        akteId: input.akteId,
        typ: "HELENA_DRAFT",
        titel: activity.titel,
        draftId: input.draftId,
      });
  } catch (err) {
    log.warn({ err }, "Failed to create draft activity entry");
  }
}
