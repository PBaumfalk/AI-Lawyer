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

// ---------- skipped messages (ruling R29) ----------

const uebersprungenSchluessel = (postfachSafeId: string) => `bea:uebersprungen:${postfachSafeId}`;

/** Escapes glob characters so a safeId is matched literally by SCAN MATCH. */
function globSicher(s: string): string {
  return s.replace(/[*?[\]\\]/g, (z) => `\\${z}`);
}

/**
 * Records a message that is no longer fetched (MAX_FEHLVERSUCHE reached).
 * The set's TTL is refreshed on every call. Redis errors only warn.
 */
export async function merkeUebersprungen(postfachSafeId: string, messageId: string): Promise<void> {
  const k = uebersprungenSchluessel(postfachSafeId);
  try {
    await redis().sadd(k, messageId);
    await redis().expire(k, TTL_SEKUNDEN);
  } catch (e) {
    warn("Merken (übersprungen)", e);
  }
}

/** Removes a message from the skipped set (it was stored after all). Redis errors only warn. */
export async function vergesseUebersprungen(postfachSafeId: string, messageId: string): Promise<void> {
  try {
    await redis().srem(uebersprungenSchluessel(postfachSafeId), messageId);
  } catch (e) {
    warn("Entfernen (übersprungen)", e);
  }
}

/** Number of skipped messages of the postbox (0 if Redis unavailable). */
export async function anzahlUebersprungen(postfachSafeId: string): Promise<number> {
  try {
    return Number(await redis().scard(uebersprungenSchluessel(postfachSafeId))) || 0;
  } catch (e) {
    warn("Lesen (übersprungen)", e);
    return 0;
  }
}

/**
 * Clears all failure counters and the skipped set of the postbox, so every
 * message is fetched again on the next run. Returns the number of skipped
 * messages that were released. Redis errors propagate: the admin must see them.
 */
export async function setzePostfachFehlversucheZurueck(postfachSafeId: string): Promise<number> {
  const r = redis();
  const uebersprungen = await r.scard(uebersprungenSchluessel(postfachSafeId));
  const muster = `bea:fehlversuch:${globSicher(postfachSafeId)}:*`;
  let cursor = "0";
  do {
    const [weiter, keys] = await r.scan(cursor, "MATCH", muster, "COUNT", 200);
    cursor = weiter;
    if (keys.length > 0) await r.del(...keys);
  } while (cursor !== "0");
  await r.del(uebersprungenSchluessel(postfachSafeId));
  return Number(uebersprungen) || 0;
}
