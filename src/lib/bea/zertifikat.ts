/**
 * Per-user storage of beA software certificates (.p12) for bea.expert.
 *
 * The p12 file and its PIN are stored encrypted with encryptCredential and
 * are only decrypted server-side for signing/decryption. Never log, return
 * to the browser or write to the audit log any p12, PIN or PEM data.
 */
import { prisma } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/email/crypto";
import { leseP12 } from "@/lib/bea/expert/krypto";
import type { BeaZertifikatStatus } from "@prisma/client";

export const ZERTIFIKAT_ABGELAUFEN = "Zertifikat ist abgelaufen";

export interface ZertifikatInfo {
  seriennummer: string;
  inhaber: string;
  gueltigBis: Date;
  status: BeaZertifikatStatus;
  letzterFehler: string | null;
  letzterAbruf: Date | null;
  safeId: string | null;
}

/**
 * Validates the p12 with the PIN and stores both encrypted for the user.
 * Replaces an existing certificate and resets a FEHLER status to AKTIV.
 * Throws on wrong PIN / invalid file or an expired certificate.
 */
export async function speichereZertifikat(
  userId: string,
  p12: Buffer,
  pin: string
): Promise<{ seriennummer: string; inhaber: string; gueltigBis: Date }> {
  const { seriennummer, inhaber, gueltigBis } = leseP12(p12, pin);
  if (gueltigBis.getTime() < Date.now()) throw new Error(ZERTIFIKAT_ABGELAUFEN);

  const daten = {
    p12Verschluesselt: encryptCredential(p12.toString("base64")),
    pinVerschluesselt: encryptCredential(pin),
    seriennummer,
    inhaber,
    gueltigBis,
    status: "AKTIV" as const,
    letzterFehler: null,
  };

  await prisma.beaZertifikat.upsert({
    where: { userId },
    create: { userId, ...daten },
    update: daten,
  });

  return { seriennummer, inhaber, gueltigBis };
}

/**
 * Returns the decrypted certificate, or null if none is stored or the
 * certificate is in FEHLER state (no retry until a new upload).
 */
export async function ladeZertifikat(userId: string): Promise<{ p12: Buffer; pin: string } | null> {
  const z = await prisma.beaZertifikat.findUnique({
    where: { userId },
    select: { p12Verschluesselt: true, pinVerschluesselt: true, status: true },
  });
  if (!z || z.status !== "AKTIV") return null;
  return {
    p12: Buffer.from(decryptCredential(z.p12Verschluesselt), "base64"),
    pin: decryptCredential(z.pinVerschluesselt),
  };
}

/** Marks the certificate as failed so background jobs stop using it. */
export async function markiereZertifikatFehler(userId: string, meldung: string): Promise<void> {
  await prisma.beaZertifikat.update({
    where: { userId },
    data: { status: "FEHLER", letzterFehler: meldung },
  });
}

/** Public metadata of the stored certificate (no secrets). */
export async function zertifikatInfo(userId: string): Promise<ZertifikatInfo | null> {
  return prisma.beaZertifikat.findUnique({
    where: { userId },
    select: {
      seriennummer: true,
      inhaber: true,
      gueltigBis: true,
      status: true,
      letzterFehler: true,
      letzterAbruf: true,
      safeId: true,
    },
  });
}

/** Removes the stored certificate. Returns false if none existed. */
export async function entferneZertifikat(userId: string): Promise<boolean> {
  const { count } = await prisma.beaZertifikat.deleteMany({ where: { userId } });
  return count > 0;
}
