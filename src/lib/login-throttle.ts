// Begrenzt Anmeldeversuche, ohne dass Fremde ein Konto aussperren können.
//
// Strategie (OWASP "Blocking Brute Force Attacks", "Device Cookies"):
//
// 1. Quelle + Konto (Standard 10 Versuche / 15 min): stoppt das Raten eines
//    Passworts von einer Quelle aus. Trifft nur diese Quelle, nicht das Konto.
//    Bisher sperrte genau diese Grenze das Konto für alle – zehn falsche
//    Passwörter von irgendwoher genügten, um die Inhaberin auszusperren.
// 2. Quelle (Standard 100 / 15 min, erfolgreiche Anmeldungen zählen nicht):
//    stoppt Credential Stuffing über viele Konten von einer Quelle aus.
// 3. Konto gesamt (Standard 50 / 15 min): greift erst bei verteilten Angriffen,
//    denn eine einzelne Quelle kommt wegen (1) höchstens auf 10. Dann werden nur
//    noch Geräte zugelassen, die sich für dieses Konto schon einmal erfolgreich
//    angemeldet haben (signiertes Geräte-Cookie, login-geraet.ts). Die
//    Inhaberin meldet sich von ihrem gewohnten Gerät weiter an.
//
// Gezählt werden Versuche vor der Passwortprüfung (atomar per Lua-Skript),
// damit parallele Anfragen die Grenze nicht unterlaufen. Eine erfolgreiche
// Anmeldung nimmt ihren eigenen Versuch wieder heraus und löscht den Zähler
// ihrer Quelle für dieses Konto.
//
// Ist Redis nicht erreichbar (Verbindung nicht binnen LIMITER_CONNECT_WAIT_MS)
// oder antwortet nicht binnen LIMITER_TIMEOUT_MS,
// wird der Versuch abgelehnt (LimiterNichtVerfuegbar → HTTP 503), statt ihn
// ungeschützt durchzulassen. Ein Ersatz im Prozessspeicher wäre bei mehreren
// Instanzen keine gemeinsame Grenze. Bestehende Sitzungen hängen nicht an Redis.
// Nach der Wiederkehr verbindet ioredis selbst neu (spätestens nach 5 s).
import { createHash } from "node:crypto";
import type Redis from "ioredis";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";

const log = createLogger("login-throttle");

function zahl(name: string, standard: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : standard;
}

export const LOGIN_SPERRE = {
  /** Versuche je Quelle und Konto im Zeitfenster */
  proQuelleUndKonto: zahl("LOGIN_LIMIT_QUELLE_KONTO", 10),
  /** Fehlversuche je Quelle über alle Konten (mehrere Mitarbeitende hinter einem NAT) */
  proQuelle: zahl("LOGIN_LIMIT_QUELLE", 100),
  /** Versuche je Konto über alle Quellen; darüber nur noch bekannte Geräte */
  proKontoGesamt: zahl("LOGIN_LIMIT_KONTO_GESAMT", 50),
  /** Falsche TOTP-/Backup-Codes je Konto im Zeitfenster */
  totpProKonto: zahl("LOGIN_LIMIT_TOTP", 10),
  fensterSekunden: zahl("LOGIN_LIMIT_FENSTER_SEKUNDEN", 15 * 60),
  /** Höchstwartezeit auf eine Redis-Antwort, danach gilt der Limiter als ausgefallen */
  timeoutMs: zahl("LIMITER_TIMEOUT_MS", 500),
  /** Höchstwartezeit auf den (Wieder-)Aufbau der Verbindung */
  verbindenMs: zahl("LIMITER_CONNECT_WAIT_MS", 1000),
} as const;

/** Text für Anmeldeversuche, solange der Anmeldeschutz (Redis) nicht erreichbar ist. */
export const ANMELDESCHUTZ_FEHLT =
  "Die Anmeldung ist gerade nicht möglich, weil der Anmeldeschutz nicht erreichbar ist. Bitte in einer Minute erneut versuchen.";

export type Sperrgrund = "quelle_konto" | "quelle" | "konto_verteilt";

/** Redis antwortet nicht: Anmeldung kontrolliert ablehnen (503). */
export class LimiterNichtVerfuegbar extends Error {
  constructor(cause?: unknown) {
    super("Anmeldeschutz vorübergehend nicht verfügbar");
    this.name = "LimiterNichtVerfuegbar";
    (this as { cause?: unknown }).cause = cause;
  }
}

let redis: Redis | null = null;
function client(): Redis {
  if (!redis) {
    redis = createRedisConnection({
      maxRetriesPerRequest: 0,
      extra: {
        // Bei getrennter Verbindung sofort Fehler statt Warteschlange,
        // bei hängendem Server nach timeoutMs.
        enableOfflineQueue: false,
        commandTimeout: LOGIN_SPERRE.timeoutMs,
        connectTimeout: 2000,
        retryStrategy: (times: number) => Math.min(250 * times, 5000),
      },
    });
  }
  return redis;
}

/** Nur für Tests: eigene Verbindung setzen oder zurücksetzen. */
export function __setLoginThrottleRedis(r: Redis | null) {
  redis = r;
}

// Fehlersignal für Betrieb/Monitoring, ohne das Log bei jedem Versuch zu fluten.
let letzteMeldung = 0;
let unterdrueckt = 0;
function ausfallMelden(err: unknown) {
  const jetzt = Date.now();
  if (jetzt - letzteMeldung < 30_000) {
    unterdrueckt++;
    return;
  }
  log.error(
    {
      event: "login_limiter_unavailable",
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      abgelehnteVersucheSeitLetzterMeldung: unterdrueckt,
    },
    "Anmeldeschutz nicht verfügbar (Redis) – Anmeldeversuche werden abgelehnt"
  );
  letzteMeldung = jetzt;
  unterdrueckt = 0;
}

/** Wartet begrenzt auf eine betriebsbereite Verbindung (Start, Wiederverbindung). */
function bereit(c: Redis): Promise<void> {
  if (c.status === "ready") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const fertig = () => {
      clearTimeout(timer);
      c.off("ready", fertig);
      resolve();
    };
    const timer = setTimeout(() => {
      c.off("ready", fertig);
      reject(new Error(`Redis nicht verbunden (Status ${c.status})`));
    }, LOGIN_SPERRE.verbindenMs);
    c.on("ready", fertig);
  });
}

async function mitLimiter<T>(fn: (_verbindung: Redis) => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const c = client();
    // Äußere Grenze: Verbindungsaufbau + Befehl zusammen.
    return await Promise.race([
      (async () => {
        await bereit(c);
        return fn(c);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Zeitüberschreitung")),
          LOGIN_SPERRE.verbindenMs + LOGIN_SPERRE.timeoutMs + 200
        );
      }),
    ]);
  } catch (err) {
    ausfallMelden(err);
    throw new LimiterNichtVerfuegbar(err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Keine E-Mail-Adressen im Klartext in Redis.
const h = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex").slice(0, 32);
const quelleName = (ip?: string | null) => (ip ? h(ip) : "unbekannt");
const kQuelleKonto = (email: string, ip?: string | null) => `login:v2:qk:${h(email)}:${quelleName(ip)}`;
const kQuelle = (ip?: string | null) => `login:v2:q:${quelleName(ip)}`;
const kKonto = (email: string) => `login:v2:k:${h(email)}`;
const kTotp = (userId: string) => `login:v2:totp:${userId}`;

const ZAEHLEN = `
local function inc(key)
  local n = redis.call('INCR', key)
  if n == 1 then redis.call('EXPIRE', key, ARGV[1]) end
  return n
end
if inc(KEYS[1]) > tonumber(ARGV[2]) then return 1 end
if inc(KEYS[2]) > tonumber(ARGV[3]) then return 2 end
local k = tonumber(redis.call('GET', KEYS[3]) or '0')
if k >= tonumber(ARGV[4]) and ARGV[5] ~= '1' then return 3 end
inc(KEYS[3])
return 0
`;

const ERFOLG = `
redis.call('DEL', KEYS[1])
for i = 2, 3 do
  local n = tonumber(redis.call('GET', KEYS[i]) or '0')
  if n > 0 then redis.call('DECR', KEYS[i]) end
end
return 0
`;

/**
 * Zählt einen Anmeldeversuch vor der Passwortprüfung und meldet, ob er
 * abgewiesen werden muss. Wirft LimiterNichtVerfuegbar, wenn Redis fehlt.
 *
 * @param geraetVertraut gültiges Geräte-Cookie für dieses Konto
 */
export async function loginGesperrt(
  email: string,
  ip?: string | null,
  opts: { geraetVertraut?: boolean } = {}
): Promise<false | Sperrgrund> {
  const r = await mitLimiter((c) =>
    c.eval(
      ZAEHLEN,
      3,
      kQuelleKonto(email, ip),
      kQuelle(ip),
      kKonto(email),
      LOGIN_SPERRE.fensterSekunden,
      LOGIN_SPERRE.proQuelleUndKonto,
      LOGIN_SPERRE.proQuelle,
      LOGIN_SPERRE.proKontoGesamt,
      opts.geraetVertraut ? "1" : "0"
    )
  );
  switch (Number(r)) {
    case 1:
      return "quelle_konto";
    case 2:
      return "quelle";
    case 3:
      return "konto_verteilt";
    default:
      return false;
  }
}

/** Nach erfolgreicher Passwortprüfung: eigenen Versuch herausnehmen. */
export async function loginErfolgreich(email: string, ip?: string | null): Promise<void> {
  try {
    await mitLimiter((c) => c.eval(ERFOLG, 3, kQuelleKonto(email, ip), kQuelle(ip), kKonto(email)));
  } catch {
    /* bereits gemeldet; die Zähler laufen ohnehin nach dem Zeitfenster ab */
  }
}

/**
 * Für die Benutzerverwaltung: alle Anmeldesperren eines Kontos aufheben,
 * ohne das Passwort zu ändern. Wirft LimiterNichtVerfuegbar.
 */
export async function loginSperreAufheben(email: string, userId?: string): Promise<void> {
  await mitLimiter(async (c) => {
    const schluessel: string[] = [kKonto(email)];
    if (userId) schluessel.push(kTotp(userId));
    let cursor = "0";
    do {
      const [next, keys] = await c.scan(cursor, "MATCH", `login:v2:qk:${h(email)}:*`, "COUNT", 200);
      schluessel.push(...keys);
      cursor = next;
    } while (cursor !== "0");
    await c.del(...schluessel);
  });
}

/**
 * Zählt einen Code-Versuch im zweiten Schritt und meldet, ob er abgewiesen
 * werden muss. Wer hier ankommt, kennt das Passwort bereits.
 * Wirft LimiterNichtVerfuegbar.
 */
export async function totpGesperrt(userId: string): Promise<boolean> {
  const n = await mitLimiter(async (c) => {
    const [[, cnt]] = (await c
      .multi()
      .incr(kTotp(userId))
      .expire(kTotp(userId), LOGIN_SPERRE.fensterSekunden, "NX")
      .exec()) as [[Error | null, number], unknown];
    return cnt;
  });
  return n > LOGIN_SPERRE.totpProKonto;
}

export async function totpErfolgreich(userId: string): Promise<void> {
  try {
    await mitLimiter((c) => c.del(kTotp(userId)));
  } catch {
    /* bereits gemeldet */
  }
}

/**
 * Allgemeine Fenstergrenze für weitere öffentliche Wege (Passwort vergessen,
 * Aktivierung, eigenes Passwort ändern). true = Grenze überschritten.
 * Wirft LimiterNichtVerfuegbar.
 */
export async function fensterUeberschritten(
  bereich: string,
  schluessel: string,
  grenze: number,
  fensterSekunden: number
): Promise<boolean> {
  const key = `limit:v1:${bereich}:${h(schluessel)}`;
  const n = await mitLimiter(async (c) => {
    const [[, cnt]] = (await c.multi().incr(key).expire(key, fensterSekunden, "NX").exec()) as [
      [Error | null, number],
      unknown,
    ];
    return cnt;
  });
  return n > grenze;
}
