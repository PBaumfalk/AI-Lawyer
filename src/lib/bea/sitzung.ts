/**
 * beA session management: one session per user, stored encrypted in Redis,
 * with controlled retry (read-only calls only).
 *
 * Never log or include token/sessionKey in error messages.
 */
import type Redis from "ioredis";
import { createRedisConnection } from "@/lib/redis";
import { encryptCredential, decryptCredential } from "@/lib/email/crypto";
import { getBeaProvider, type BeaProvider, type BeaSitzung } from "./provider";
import { BeaExpertError } from "./expert/transport";
import { ladeZertifikat, setzeZertifikatSafeId } from "./zertifikat";

const SITZUNG_TTL_SEKUNDEN = 600;
const schluessel = (userId: string) => `bea:sitzung:${userId}`;

export class BeaNichtEingerichtetError extends Error {
  constructor(message = "beA ist nicht eingerichtet.") {
    super(message);
    this.name = "BeaNichtEingerichtetError";
  }
}

// One shared connection per process, created lazily.
let redisInstanz: Redis | null = null;
function redis(): Redis {
  // Fail fast: Redis is only a cache, its outage must not block beA.
  return (redisInstanz ??= createRedisConnection({
    maxRetriesPerRequest: 1,
    extra: { commandTimeout: 2000 },
  }));
}

async function ladeGespeicherteSitzung(userId: string): Promise<BeaSitzung | null> {
  let roh: string | null;
  try {
    roh = await redis().get(schluessel(userId));
  } catch (e) {
    warnRedis("Lesen", userId, e);
    return null;
  }
  if (!roh) return null;
  try {
    const d = JSON.parse(decryptCredential(roh)) as { token: string; sessionKey: string; safeId: string };
    return { token: d.token, sessionKey: Buffer.from(d.sessionKey, "base64"), safeId: d.safeId };
  } catch {
    // Unreadable entry (e.g. key rotation): treat as no session.
    await verwerfeBeaSitzung(userId);
    return null;
  }
}

function warnRedis(aktion: string, userId: string, e: unknown): void {
  // Log only the error message, never session data.
  console.warn(`[bea] Redis ${aktion} fehlgeschlagen (userId=${userId}): ${e instanceof Error ? e.message : "unbekannt"}`);
}

async function speichereSitzung(userId: string, s: BeaSitzung): Promise<void> {
  const payload = JSON.stringify({
    token: s.token,
    sessionKey: s.sessionKey.toString("base64"),
    safeId: s.safeId,
  });
  try {
    await redis().set(schluessel(userId), encryptCredential(payload), "EX", SITZUNG_TTL_SEKUNDEN);
  } catch (e) {
    warnRedis("Schreiben", userId, e);
  }
}

async function anmeldenUndSpeichern(userId: string, provider: BeaProvider): Promise<BeaSitzung> {
  // ladeZertifikat checks the certificate locally (PIN, format, expiry) and marks
  // it FEHLER itself; null means "no usable certificate" (ruling R28).
  const zert = await ladeZertifikat(userId);
  if (!zert) throw new BeaNichtEingerichtetError("Kein gültiges beA-Zertifikat hinterlegt.");

  // Every failure of the bea.expert login (4xx, 429, error answers, 5xx, network)
  // and every failure of our own stack is treated as an outage: it is rethrown
  // and the certificate stays AKTIV.
  const sitzung = await provider.anmelden(zert.p12, zert.pin);

  await speichereSitzung(userId, sitzung);
  await setzeZertifikatSafeId(userId, sitzung.safeId);
  return sitzung;
}

/**
 * Runs fn with the user's beA session.
 * wiederholen=true (read-only calls): on BeaExpertError the session is checked;
 * only if bea.expert reports it invalid is it dropped, a fresh login made and fn
 * run exactly once more. Otherwise the original error is rethrown.
 * wiederholen=false (send/draft/eEB): the session is verified up front; fn is never repeated.
 */
export async function mitBeaSitzung<T>(
  userId: string,
  fn: (s: BeaSitzung, p: BeaProvider) => Promise<T>,
  opts: { wiederholen: boolean },
): Promise<T> {
  const provider = getBeaProvider();
  if (!provider) throw new BeaNichtEingerichtetError();

  let sitzung = await ladeGespeicherteSitzung(userId);

  if (!opts.wiederholen) {
    // An outage during the check propagates: no re-login, fn is not called.
    if (sitzung && !(await provider.pruefeSitzung(sitzung))) {
      await verwerfeBeaSitzung(userId);
      sitzung = null;
    }
    sitzung ??= await anmeldenUndSpeichern(userId, provider);
    return fn(sitzung, provider);
  }

  sitzung ??= await anmeldenUndSpeichern(userId, provider);
  try {
    return await fn(sitzung, provider);
  } catch (e) {
    if (!(e instanceof BeaExpertError)) throw e;
    // Retry only for an invalid session; a failing check is no reason to retry.
    let gueltig: boolean;
    try {
      gueltig = await provider.pruefeSitzung(sitzung);
    } catch {
      throw e;
    }
    if (gueltig) throw e;
    await verwerfeBeaSitzung(userId);
    const neu = await anmeldenUndSpeichern(userId, provider);
    return fn(neu, provider);
  }
}

/** Drops the stored session of the user. */
export async function verwerfeBeaSitzung(userId: string): Promise<void> {
  try {
    await redis().del(schluessel(userId));
  } catch (e) {
    warnRedis("Löschen", userId, e);
  }
}
