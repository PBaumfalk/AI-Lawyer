// Prüfung von E-Mail und Passwort für die Anmeldung (Credentials-Provider).
// Aus auth.ts herausgelöst, damit sie ohne NextAuth-Laufzeit testbar ist.
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { loginGesperrt, loginErfolgreich } from "@/lib/login-throttle";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export function clientIp(request?: Request | null): string | null {
  const h = request?.headers;
  if (!h || typeof h.get !== "function") return null;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return h.get("x-real-ip");
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
  | { ok: false; grund: "ungueltig" | "gesperrt" | "totp_erforderlich" };

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

  const sperre = await loginGesperrt(email, ip);
  if (sperre) {
    logAuditEvent({
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: sperre === "konto" ? "Zu viele Versuche (Konto)" : "Zu viele Versuche (IP)" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "gesperrt" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.aktiv || user.isSystem) {
    logAuditEvent({
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: !user ? "Benutzer nicht gefunden" : "Konto deaktiviert" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "ungueltig" };
  }

  const passwordMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatch) {
    logAuditEvent({
      userId: user.id,
      aktion: "LOGIN_FEHLGESCHLAGEN",
      details: { email, grund: "Falsches Passwort" },
      ipAdresse: ip ?? undefined,
    }).catch(() => {});
    return { ok: false, grund: "ungueltig" };
  }

  await loginErfolgreich(email);
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
