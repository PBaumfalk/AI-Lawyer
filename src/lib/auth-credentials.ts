// Prüfung von E-Mail und Passwort für die Anmeldung (Credentials-Provider).
// Aus auth.ts herausgelöst, damit sie ohne NextAuth-Laufzeit testbar ist.
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { loginGesperrt, loginErfolgreich, LimiterNichtVerfuegbar } from "@/lib/login-throttle";
import { geraetCookieAus, geraetVertraut } from "@/lib/login-geraet";
import { clientIp } from "@/lib/client-ip";

export { clientIp };

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

// Vergleichs-Hash für unbekannte oder deaktivierte Konten: bcrypt läuft immer,
// damit die Antwortzeit nicht verrät, ob es ein Konto gibt (Kostenfaktor wie
// bei echten Konten).
let dummyHash: Promise<string> | null = null;
function vergleichsHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(`kein-konto-${Math.random()}`, 12);
  return dummyHash;
}

export interface AngemeldeterBenutzer {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  kanzleiId: string | null;
  kontaktId: string | null;
  totpEnabled: boolean;
}

export type Pruefung =
  | { ok: true; user: AngemeldeterBenutzer }
  | { ok: false; grund: "ungueltig" | "gesperrt" | "totp_erforderlich" | "dienst" };

/**
 * Prüft E-Mail und Passwort.
 *
 * Konten mit Zwei-Faktor-Anmeldung werden hier abgewiesen
 * ("totp_erforderlich"), außer für die Vorstufe /api/auth/totp/init
 * (`fuerTotpVorstufe`). Sonst ließe sich der zweite Faktor umgehen, indem man
 * E-Mail und Passwort direkt an den NextAuth-Callback schickt.
 */
export async function pruefePasswort(
  credentials: unknown,
  request?: Request | null,
  opts: { fuerTotpVorstufe?: boolean } = {}
): Promise<Pruefung> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return { ok: false, grund: "ungueltig" };
  // E-Mails sind in der Datenbank klein geschrieben (Benutzerverwaltung, Seed).
  const email = parsed.data.email.trim().toLowerCase();
  const ip = clientIp(request);

  const vertraut = geraetVertraut(geraetCookieAus(request), email);

  let sperre: Awaited<ReturnType<typeof loginGesperrt>>;
  try {
    sperre = await loginGesperrt(email, ip, { geraetVertraut: vertraut });
  } catch (err) {
    if (err instanceof LimiterNichtVerfuegbar) return { ok: false, grund: "dienst" };
    throw err;
  }
  if (sperre) {
    logAuditEvent({
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: {
        email,
        grund:
          sperre === "quelle_konto"
            ? "Zu viele Versuche von dieser Quelle für dieses Konto"
            : sperre === "quelle"
              ? "Zu viele Versuche von dieser Quelle"
              : "Verteilter Angriff auf das Konto, unbekanntes Gerät",
      },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "gesperrt" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const nutzbar = !!user && user.aktiv && !user.isSystem;
  // Immer vergleichen, auch ohne nutzbares Konto (gleiche Laufzeit).
  const passwordMatch = await bcrypt.compare(
    parsed.data.password,
    nutzbar ? user.passwordHash : await vergleichsHash()
  );

  if (!nutzbar) {
    logAuditEvent({
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: !user ? "Benutzer nicht gefunden" : "Konto deaktiviert" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "ungueltig" };
  }

  if (!passwordMatch) {
    logAuditEvent({
      userId: user.id,
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: "Falsches Passwort" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "ungueltig" };
  }

  await loginErfolgreich(email, ip);
  if (user.totpEnabled && !opts.fuerTotpVorstufe) {
    logAuditEvent({
      userId: user.id,
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: "Zweiter Faktor fehlt" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "totp_erforderlich" };
  }
  const angemeldet: AngemeldeterBenutzer = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    kanzleiId: user.kanzleiId,
    kontaktId: user.kontaktId,
    totpEnabled: user.totpEnabled,
  };
  return { ok: true, user: angemeldet };
}
