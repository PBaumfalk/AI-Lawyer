/**
 * Per-message failure counter for the beA retrieval, kept in Redis.
 * A message that fails repeatedly is skipped so it cannot block the inbox.
 * Redis is only a helper here: its outage is logged and treated as "no failures".
 */
import type Redis from "ioredis";
import { createRedisConnection } from "@/lib/redis";

export const MAX_FEHLVERSUCHE = 3;
const TTL_SEKUNDEN = 7 * 24 * 60 * 60;

const schluessel = (postfachSafeId: string, messageId: string) =>
  `bea:fehlversuch:${postfachSafeId}:${messageId}`;

let redisInstanz: Redis | null = null;
function redis(): Redis {
  return (redisInstanz ??= createRedisConnection({
    maxRetriesPerRequest: 1,
    extra: { commandTimeout: 2000 },
  }));
}

function warn(aktion: string, e: unknown): void {
  console.warn(`[bea] Fehlversuchszähler ${aktion} fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`);
}

/** Number of failed attempts recorded for the message (0 if unknown or Redis unavailable). */
export async function fehlversuche(postfachSafeId: string, messageId: string): Promise<number> {
  try {
    return Number(await redis().get(schluessel(postfachSafeId, messageId))) || 0;
  } catch (e) {
    warn("Lesen", e);
    return 0;
  }
}

/** Records one failed attempt and returns the new count (0 if Redis unavailable). */
export async function zaehleFehlversuch(postfachSafeId: string, messageId: string): Promise<number> {
  const k = schluessel(postfachSafeId, messageId);
  try {
    const anzahl = await redis().incr(k);
    await redis().expire(k, TTL_SEKUNDEN);
    return anzahl;
  } catch (e) {
    warn("Schreiben", e);
    return 0;
  }
}

/** Clears the failure counter so the message is fetched again on the next run. */
export async function setzeFehlversucheZurueck(postfachSafeId: string, messageId: string): Promise<void> {
  try {
    await redis().del(schluessel(postfachSafeId, messageId));
  } catch (e) {
    warn("Zurücksetzen", e);
  }
}
