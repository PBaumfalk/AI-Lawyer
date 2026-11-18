// Grundausstattung einer neuen Installation.
//
// Produktion (NODE_ENV=production, kein SEED_DEMO=true): genau ein
// Administratorkonto mit dem Passwort aus INITIAL_ADMIN_PASSWORD, dazu der
// Systembenutzer Helena. Keine Beispielkonten, kein bekanntes Passwort.
// Entwicklung/Demo: zusätzlich Beispielkonten und Beispielakten (seed.ts).
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export const DEMO_PASSWORT = "password123";
export const MIN_ADMIN_PASSWORT_LAENGE = 12;

type Env = Record<string, string | undefined>;

export function isDemoSeed(env: Env = process.env): boolean {
  if (env.SEED_DEMO === "true") return true;
  if (env.SEED_DEMO === "false") return false;
  return env.NODE_ENV !== "production";
}

export interface BasisErgebnis {
  kanzleiId: string;
  adminId: string;
  adminEmail: string;
  /** Nur gesetzt, wenn das Passwort hier erzeugt wurde und einmalig angezeigt werden muss. */
  erzeugtesPasswort?: string;
}

export async function seedBasis(prisma: Pick<PrismaClient, "kanzlei" | "user">, env: Env = process.env): Promise<BasisErgebnis> {
  const demo = isDemoSeed(env);

  const kanzlei = await prisma.kanzlei.upsert({
    where: { id: "kanzlei-baumfalk" },
    update: {},
    create: demo
      ? {
          id: "kanzlei-baumfalk",
          name: "Kanzlei Baumfalk",
          strasse: "Westfalendamm 87",
          plz: "44141",
          ort: "Dortmund",
          telefon: "+49 231 12345678",
          email: "info@kanzlei-baumfalk.de",
          website: "https://kanzlei-baumfalk.de",
        }
      : { id: "kanzlei-baumfalk", name: env.KANZLEI_NAME?.trim() || "Kanzlei" },
  });

  let passwort: string;
  let erzeugtesPasswort: string | undefined;
  if (demo) {
    passwort = DEMO_PASSWORT;
  } else if (env.INITIAL_ADMIN_PASSWORD) {
    passwort = env.INITIAL_ADMIN_PASSWORD;
    if (passwort.length < MIN_ADMIN_PASSWORT_LAENGE) {
      throw new Error(
        `INITIAL_ADMIN_PASSWORD ist zu kurz (mindestens ${MIN_ADMIN_PASSWORT_LAENGE} Zeichen).`
      );
    }
  } else {
    // Kein Passwort vorgegeben: zufällig erzeugen und einmalig ausgeben, statt
    // ein bekanntes Standardpasswort zu setzen.
    passwort = randomBytes(18).toString("base64url");
    erzeugtesPasswort = passwort;
  }

  const adminEmail = demo
    ? "admin@kanzlei.de"
    : (env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || "admin@kanzlei.de");

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: demo ? "Patrick Baumfalk" : "Administrator",
      passwordHash: await bcrypt.hash(passwort, 12),
      role: "ADMIN",
      position: demo ? "Kanzleiinhaber" : null,
      kanzleiId: kanzlei.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "helena@system.local" },
    update: { isSystem: true },
    create: {
      email: "helena@system.local",
      name: "Helena",
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12), // nicht anmeldbar
      role: "SACHBEARBEITER",
      isSystem: true,
      aktiv: false,
      position: "KI-Assistentin",
      kanzleiId: kanzlei.id,
    },
  });

  return { kanzleiId: kanzlei.id, adminId: admin.id, adminEmail, erzeugtesPasswort };
}
