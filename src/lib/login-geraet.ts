// Geräte-Cookie für die Anmeldung (OWASP "Slow Down Online Guessing Attacks
// with Device Cookies").
//
// Nach einer vollständig erfolgreichen Anmeldung erhält der Browser ein
// signiertes Cookie, das an das Konto gebunden ist. Läuft gegen ein Konto ein
// verteilter Rateangriff, lässt login-throttle.ts nur noch Geräte mit diesem
// Cookie zu. Die Inhaberin bleibt dadurch anmeldbar, ohne dass jemand ihr
// Passwort ändern muss. Das Cookie ersetzt keine Anmeldung: Passwort und
// zweiter Faktor werden immer geprüft.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GERAET_COOKIE = "ailawyer_geraet";
export const GERAET_MAX_AGE_SEKUNDEN = 180 * 24 * 60 * 60;

function geheimnis(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

const kontoBindung = (email: string) =>
  createHash("sha256").update(`geraet:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 22);

function signatur(daten: string, secret: string): string {
  return createHmac("sha256", secret).update(`login-geraet.v1.${daten}`).digest("base64url");
}

/** Erzeugt den Cookie-Wert für ein Konto; null ohne konfiguriertes Geheimnis. */
export function geraetTokenErzeugen(email: string, jetzt = Date.now()): string | null {
  const secret = geheimnis();
  if (!secret) return null;
  const ablauf = Math.floor(jetzt / 1000) + GERAET_MAX_AGE_SEKUNDEN;
  const daten = `${kontoBindung(email)}.${randomBytes(9).toString("base64url")}.${ablauf}`;
  return `${daten}.${signatur(daten, secret)}`;
}

/** Prüft Signatur, Ablauf und Bindung an genau dieses Konto. */
export function geraetVertraut(token: string | null | undefined, email: string, jetzt = Date.now()): boolean {
  const secret = geheimnis();
  if (!secret || !token) return false;
  const teile = token.split(".");
  if (teile.length !== 4) return false;
  const [bindung, , ablauf, sig] = teile;
  const daten = teile.slice(0, 3).join(".");
  const erwartet = Buffer.from(signatur(daten, secret));
  const erhalten = Buffer.from(sig!);
  if (erwartet.length !== erhalten.length || !timingSafeEqual(erwartet, erhalten)) return false;
  if (!(Number(ablauf) > Math.floor(jetzt / 1000))) return false;
  return bindung === kontoBindung(email);
}

/** Liest das Geräte-Cookie aus einer Anfrage (Cookie-Header). */
export function geraetCookieAus(request?: Request | null): string | null {
  const header = request?.headers?.get?.("cookie");
  if (!header) return null;
  for (const teil of header.split(";")) {
    const i = teil.indexOf("=");
    if (i > 0 && teil.slice(0, i).trim() === GERAET_COOKIE) return teil.slice(i + 1).trim();
  }
  return null;
}

export const geraetCookieOptionen = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: GERAET_MAX_AGE_SEKUNDEN,
};
