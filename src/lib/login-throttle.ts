// Begrenzt Anmeldeversuche je Konto und je IP-Adresse.
//
// Gezählt werden Versuche, nicht erst Fehlschläge: INCR ist atomar, damit
// greift die Grenze auch bei vielen parallelen Anfragen, die sonst alle vor dem
// ersten protokollierten Fehlschlag durchkämen. Eine erfolgreiche Anmeldung
// setzt den Zähler des Kontos zurück.
//
// Ist Redis nicht erreichbar, bleibt die Anmeldung möglich (Verfügbarkeit vor
// Sperre); das wird protokolliert.
import type Redis from "ioredis";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";

const log = createLogger("login-throttle");

export const LOGIN_SPERRE = {
  /** Versuche je Konto im Zeitfenster */
  proKonto: 10,
  /** Versuche je IP-Adresse im Zeitfenster (mehrere Mitarbeitende hinter einem NAT) */
  proIp: 50,
  /** Falsche TOTP-/Backup-Codes je Konto im Zeitfenster */
  totpProKonto: 10,
  fensterSekunden: 15 * 60,
} as const;

let redis: Redis | null = null;
function client(): Redis {
  if (!redis) redis = createRedisConnection({ maxRetriesPerRequest: 1 });
  return redis;
}

/** Nur für Tests: eigene Verbindung setzen oder zurücksetzen. */
export function __setLoginThrottleRedis(r: Redis | null) {
  redis = r;
}

const kontoKey = (email: string) => `login:versuche:konto:${email.trim().toLowerCase()}`;
const ipKey = (ip: string) => `login:versuche:ip:${ip}`;

async function zaehlen(key: string): Promise<number> {
  const r = client();
  const [[, n]] = (await r.multi().incr(key).expire(key, LOGIN_SPERRE.fensterSekunden, "NX").exec()) as [
    [Error | null, number],
    unknown,
  ];
  return n;
}

/**
 * Zählt einen Anmeldeversuch und meldet, ob er abgewiesen werden muss.
 * Wird vor der Passwortprüfung aufgerufen.
 */
export async function loginGesperrt(email: string, ip?: string | null): Promise<false | "konto" | "ip"> {
  try {
    const n = await zaehlen(kontoKey(email));
    if (n > LOGIN_SPERRE.proKonto) return "konto";
    if (ip) {
      const m = await zaehlen(ipKey(ip));
      if (m > LOGIN_SPERRE.proIp) return "ip";
    }
    return false;
  } catch (err) {
    log.warn({ err }, "Anmeldebegrenzung nicht verfügbar (Redis), Versuch wird zugelassen");
    return false;
  }
}

/** Nach erfolgreicher Anmeldung: Zähler des Kontos zurücksetzen. */
export async function loginErfolgreich(email: string): Promise<void> {
  try {
    await client().del(kontoKey(email));
  } catch {
    /* nicht kritisch */
  }
}

/** Für die Benutzerverwaltung: Sperre eines Kontos aufheben. */
export async function loginSperreAufheben(email: string, userId?: string): Promise<void> {
  await loginErfolgreich(email);
  if (userId) await totpErfolgreich(userId);
}

const totpKey = (userId: string) => `login:versuche:totp:${userId}`;

/** Zählt einen Code-Versuch im zweiten Schritt und meldet, ob er abgewiesen werden muss. */
export async function totpGesperrt(userId: string): Promise<boolean> {
  try {
    return (await zaehlen(totpKey(userId))) > LOGIN_SPERRE.totpProKonto;
  } catch (err) {
    log.warn({ err }, "TOTP-Begrenzung nicht verfügbar (Redis), Versuch wird zugelassen");
    return false;
  }
}

export async function totpErfolgreich(userId: string): Promise<void> {
  try {
    await client().del(totpKey(userId));
  } catch {
    /* nicht kritisch */
  }
}
