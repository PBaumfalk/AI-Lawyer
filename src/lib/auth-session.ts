// Gleicht ein JWT bei jedem Sitzungsabruf mit der Datenbank ab.
//
// Sitzungen sind JWTs mit 30 Tagen Laufzeit. Ohne diesen Abgleich behielt ein
// deaktiviertes Konto bis zu 30 Tage Zugriff, und eine geänderte Rolle wirkte
// erst nach erneutem Login. Läuft nur in der Node-Laufzeit (auth.ts), nicht in
// der Edge-Middleware.
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

const TTL_MS = 10_000;

interface Eintrag {
  at: number;
  aktiv: boolean;
  role: UserRole;
  kanzleiId: string | null;
  kontaktId: string | null;
  sessionsGueltigAb: number;
}

const cache = new Map<string, Eintrag>();

/** Nach Änderungen an Konto, Rolle oder Passwort aufrufen, damit sie sofort wirken. */
export function invalidateUserSessionCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function laden(userId: string): Promise<Eintrag | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { aktiv: true, role: true, kanzleiId: true, kontaktId: true, sessionsGueltigAb: true },
  });
  if (!u) {
    cache.delete(userId);
    return null;
  }
  const e: Eintrag = {
    at: Date.now(),
    aktiv: u.aktiv,
    role: u.role,
    kanzleiId: u.kanzleiId,
    kontaktId: u.kontaktId,
    sessionsGueltigAb: u.sessionsGueltigAb ? u.sessionsGueltigAb.getTime() : 0,
  };
  cache.set(userId, e);
  return e;
}

type Token = Record<string, unknown> & { sub?: string; iat?: number };

/**
 * Gibt das aktualisierte Token zurück oder null, wenn die Sitzung beendet
 * werden muss (Konto gelöscht oder deaktiviert, Sitzungen widerrufen).
 */
export async function refreshTokenFromDb<T extends Token>(token: T): Promise<T | null> {
  if (!token.sub) return token;
  const u = await laden(token.sub);
  if (!u || !u.aktiv) return null;
  // Passwortwechsel oder "alle Sitzungen beenden": ältere Tokens verwerfen.
  // iat ist in Sekunden; eine Sekunde Toleranz für die Anmeldung im selben Moment.
  if (u.sessionsGueltigAb && typeof token.iat === "number" && token.iat * 1000 < u.sessionsGueltigAb - 1000) {
    return null;
  }
  const t = token as Token;
  t.role = u.role;
  t.kanzleiId = u.kanzleiId;
  if (u.role === "MANDANT") t.kontaktId = u.kontaktId;
  return token;
}
