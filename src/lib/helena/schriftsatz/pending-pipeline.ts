/**
 * PendingSchriftsatz CRUD service.
 *
 * Manages in-flight Schriftsatz pipeline state for multi-turn Rueckfragen.
 * State is per-user-per-Akte, database-persisted, with 7-day TTL.
 */

import { prisma } from "@/lib/db";
import type { IntentResult } from "./schemas";
import type { SlotValues } from "./slot-filler";

const TTL_DAYS = 7;
const MAX_ROUNDS = 5;

export { MAX_ROUNDS };

export interface PendingPipelineState {
  id: string;
  userId: string;
  akteId: string;
  intentState: IntentResult;
  slotState: SlotValues;
  rueckfrage: string;
  round: number;
  message: string;
  expiresAt: Date;
}

/**
 * Save or update pending pipeline state (upsert).
 * Sets expiresAt to now + 7 days on every save.
 */
export async function savePendingPipeline(params: {
  userId: string;
  akteId: string;
  intentState: IntentResult;
  slotState: SlotValues;
  rueckfrage: string;
  round: number;
  message: string;
}): Promise<PendingPipelineState> {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  const record = await prisma.pendingSchriftsatz.upsert({
    where: {
      userId_akteId: {
        userId: params.userId,
        akteId: params.akteId,
      },
    },
    create: {
      userId: params.userId,
      akteId: params.akteId,
      intentState: params.intentState as any,
      slotState: params.slotState as any,
      rueckfrage: params.rueckfrage,
      round: params.round,
      message: params.message,
      expiresAt,
    },
    update: {
      intentState: params.intentState as any,
      slotState: params.slotState as any,
      rueckfrage: params.rueckfrage,
      round: params.round,
      expiresAt,
    },
  });

  return {
    id: record.id,
    userId: record.userId,
    akteId: record.akteId,
    intentState: record.intentState as unknown as IntentResult,
    slotState: record.slotState as unknown as SlotValues,
    rueckfrage: record.rueckfrage,
    round: record.round,
    message: record.message,
    expiresAt: record.expiresAt,
  };
}

/**
 * Load pending pipeline state for a user+Akte combination.
 * Returns null if no state exists or if expired (auto-deletes expired records).
 */
export async function loadPendingPipeline(
  userId: string,
  akteId: string,
): Promise<PendingPipelineState | null> {
  const record = await prisma.pendingSchriftsatz.findUnique({
    where: { userId_akteId: { userId, akteId } },
  });

  if (!record) return null;

  // Lazy TTL check -- delete expired records on read
  if (record.expiresAt < new Date()) {
    await prisma.pendingSchriftsatz.delete({
      where: { id: record.id },
    }).catch(() => {}); // Swallow race condition
    return null;
  }

  return {
    id: record.id,
    userId: record.userId,
    akteId: record.akteId,
    intentState: record.intentState as unknown as IntentResult,
    slotState: record.slotState as unknown as SlotValues,
    rueckfrage: record.rueckfrage,
    round: record.round,
    message: record.message,
    expiresAt: record.expiresAt,
  };
}

/**
 * Clear (delete) pending pipeline state for a user+Akte.
 * Used on: cancel, unrelated message, pipeline completion.
 */
export async function clearPendingPipeline(
  userId: string,
  akteId: string,
): Promise<void> {
  await prisma.pendingSchriftsatz.deleteMany({
    where: { userId, akteId },
  });
}
