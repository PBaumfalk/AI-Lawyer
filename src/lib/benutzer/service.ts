// Benutzerverwaltung für Kanzleikonten (nur ADMIN).
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { invalidateUserSessionCache } from "@/lib/auth-session";
import { fensterUeberschritten, LimiterNichtVerfuegbar, loginSperreAufheben, LOGIN_SPERRE } from "@/lib/login-throttle";
import {
  KANZLEI_ROLLEN,
  type BenutzerAendern,
  type BenutzerAnlegen,
  type BenutzerZeile,
  type KanzleiRolle,
  type StartpasswortAntwort,
} from "./schema";

export class BenutzerFehler extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const auswahl = {
  id: true,
  email: true,
  name: true,
  role: true,
  position: true,
  aktiv: true,
  totpEnabled: true,
  createdAt: true,
} as const;

type Roh = Prisma.UserGetPayload<{ select: typeof auswahl }>;

function zeile(u: Roh): BenutzerZeile {
  return { ...u, role: u.role as KanzleiRolle, createdAt: u.createdAt.toISOString() };
}

/** Lesbares Startpasswort ohne verwechselbare Zeichen (0/O, 1/l/I). */
export function startpasswort(): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += zeichen[bytes[i]! % zeichen.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

const kanzleiKonto = { isSystem: false, role: { in: [...KANZLEI_ROLLEN] } } satisfies Prisma.UserWhereInput;

export async function listeBenutzer(): Promise<BenutzerZeile[]> {
  const rows = await prisma.user.findMany({
    where: kanzleiKonto,
    select: auswahl,
    orderBy: [{ aktiv: "desc" }, { name: "asc" }],
  });
  return rows.map(zeile);
}

export async function findeKanzleiKonto(id: string) {
  const u = await prisma.user.findFirst({ where: { id, ...kanzleiKonto }, select: { ...auswahl, kanzleiId: true } });
  if (!u) throw new BenutzerFehler("Benutzer nicht gefunden", 404);
  return u;
}

export async function legeBenutzerAn(adminId: string, daten: BenutzerAnlegen): Promise<StartpasswortAntwort> {
  const vorhanden = await prisma.user.findUnique({ where: { email: daten.email }, select: { id: true } });
  if (vorhanden) throw new BenutzerFehler("Diese E-Mail-Adresse ist bereits vergeben", 409);

  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { kanzleiId: true } });
  const passwort = daten.passwort ?? startpasswort();
  try {
    const u = await prisma.user.create({
      data: {
        email: daten.email,
        name: daten.name,
        role: daten.role,
        position: daten.position || null,
        passwordHash: await bcrypt.hash(passwort, 12),
        kanzleiId: admin?.kanzleiId ?? null,
      },
      select: auswahl,
    });
    await logAuditEvent({
      userId: adminId,
      aktion: "BENUTZER_ANGELEGT",
      details: { benutzerId: u.id, email: u.email, rolle: u.role },
    });
    return { benutzer: zeile(u), startpasswort: daten.passwort ? undefined : passwort };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new BenutzerFehler("Diese E-Mail-Adresse ist bereits vergeben", 409);
    }
    throw e;
  }
}

/** Mindestens ein aktives Administratorkonto muss bleiben, sonst ist die Kanzlei ausgesperrt. */
async function pruefeLetzterAdmin(id: string, aenderung: BenutzerAendern) {
  const verliertAdmin =
    aenderung.aktiv === false || (aenderung.role !== undefined && aenderung.role !== "ADMIN");
  if (!verliertAdmin) return;
  const andere = await prisma.user.count({
    where: { role: "ADMIN", aktiv: true, isSystem: false, id: { not: id } },
  });
  if (andere === 0) {
    throw new BenutzerFehler("Das letzte aktive Administratorkonto kann nicht deaktiviert oder herabgestuft werden", 409);
  }
}

export async function aendereBenutzer(adminId: string, id: string, aenderung: BenutzerAendern): Promise<BenutzerZeile> {
  const vorher = await findeKanzleiKonto(id);
  if (id === adminId && aenderung.aktiv === false) {
    throw new BenutzerFehler("Das eigene Konto kann nicht deaktiviert werden", 409);
  }
  const u = await prisma.$transaction(
    async (tx) => {
      // Serialisiert gegen eine zweite gleichzeitige Herabstufung des vorletzten Admins
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
      await pruefeLetzterAdmin(id, aenderung);
      return tx.user.update({
        where: { id },
        data: {
          ...aenderung,
          ...(aenderung.position !== undefined ? { position: aenderung.position || null } : {}),
        },
        select: auswahl,
      });
    },
    { timeout: 10_000 }
  );
  invalidateUserSessionCache(id);
  const geaendert = Object.fromEntries(
    Object.entries(aenderung).filter(([k, v]) => (vorher as Record<string, unknown>)[k] !== v)
  );
  await logAuditEvent({
    userId: adminId,
    aktion: "BENUTZER_GEAENDERT",
    details: { benutzerId: id, email: u.email, aenderungen: geaendert },
  });
  return zeile(u);
}

export async function setzePasswortZurueck(
  adminId: string,
  id: string,
  opts: { totpZuruecksetzen?: boolean } = {}
): Promise<StartpasswortAntwort> {
  const vorher = await findeKanzleiKonto(id);
  const passwort = startpasswort();
  const u = await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(passwort, 12),
      sessionsGueltigAb: new Date(),
      ...(opts.totpZuruecksetzen
        ? { totpEnabled: false, totpSecret: null, totpVerifiedAt: null, backupCodes: [], totpNonce: null }
        : {}),
    },
    select: auswahl,
  });
  invalidateUserSessionCache(id);
  // Das neue Passwort gilt bereits; fehlt Redis, laufen alte Zähler nach dem
  // Zeitfenster ab.
  await loginSperreAufheben(vorher.email, id).catch(() => {});
  await logAuditEvent({
    userId: adminId,
    aktion: "BENUTZER_PASSWORT_ZURUECKGESETZT",
    details: { benutzerId: id, email: u.email, totpZurueckgesetzt: !!opts.totpZuruecksetzen },
  });
  return { benutzer: zeile(u), startpasswort: passwort };
}

/**
 * Hebt alle Anmeldesperren eines Kontos auf, ohne das Passwort zu ändern
 * (z. B. nach einem Rateangriff von außen). Sitzungen bleiben bestehen.
 */
export async function entsperreBenutzer(adminId: string, id: string): Promise<void> {
  const u = await findeKanzleiKonto(id);
  try {
    await loginSperreAufheben(u.email, id);
  } catch (e) {
    if (e instanceof LimiterNichtVerfuegbar) {
      throw new BenutzerFehler("Der Anmeldeschutz ist gerade nicht erreichbar. Bitte später erneut versuchen.", 503);
    }
    throw e;
  }
  await logAuditEvent({ userId: adminId, aktion: "BENUTZER_ENTSPERRT", details: { benutzerId: id, email: u.email } });
}

export async function aendereEigenesPasswort(userId: string, aktuell: string, neu: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, isSystem: true } });
  if (!u || u.isSystem) throw new BenutzerFehler("Benutzer nicht gefunden", 404);
  // Eine offene Sitzung darf kein unbegrenztes Passwort-Orakel sein.
  let zuViele: boolean;
  try {
    zuViele = await fensterUeberschritten("eigenes-passwort", userId, LOGIN_SPERRE.proQuelleUndKonto, LOGIN_SPERRE.fensterSekunden);
  } catch (e) {
    if (e instanceof LimiterNichtVerfuegbar) {
      throw new BenutzerFehler("Der Anmeldeschutz ist gerade nicht erreichbar. Bitte später erneut versuchen.", 503);
    }
    throw e;
  }
  if (zuViele) throw new BenutzerFehler("Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.", 429);
  if (!(await bcrypt.compare(aktuell, u.passwordHash))) {
    throw new BenutzerFehler("Das aktuelle Passwort ist falsch", 400);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(neu, 12), sessionsGueltigAb: new Date() },
  });
  invalidateUserSessionCache(userId);
  await logAuditEvent({ userId, aktion: "PASSWORT_GEAENDERT", details: {} });
}
