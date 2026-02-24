/**
 * SMTP transport factory: creates nodemailer transporter per EmailKonto.
 * Lazy creation with caching (one transporter per kontoId).
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { decryptCredential } from "@/lib/email/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("smtp:transport");

/** Cache of SMTP transporters keyed by kontoId */
const transporterCache = new Map<string, Transporter>();

/**
 * Create or retrieve a cached nodemailer SMTP transporter for a given EmailKonto.
 *
 * @param konto - Email account configuration
 * @returns Configured nodemailer transporter
 */
export function createSmtpTransport(konto: {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  benutzername: string;
  passwortEnc: string | null;
  oauthTokens: any;
  authTyp: string;
  emailAdresse: string;
}): Transporter {
  // Return cached transporter if available
  const cached = transporterCache.get(konto.id);
  if (cached) {
    return cached;
  }

  log.info(
    { kontoId: konto.id, host: konto.smtpHost, port: konto.smtpPort },
    "Creating SMTP transport"
  );

  let auth: any;

  if (konto.authTyp === "OAUTH2" && konto.oauthTokens) {
    const tokens = typeof konto.oauthTokens === "string"
      ? JSON.parse(konto.oauthTokens)
      : konto.oauthTokens;

    auth = {
      type: "OAuth2",
      user: konto.benutzername,
      accessToken: tokens.accessToken,
    };
  } else if (konto.passwortEnc) {
    const password = decryptCredential(konto.passwortEnc);
    auth = {
      user: konto.benutzername,
      pass: password,
    };
  }

  const transporter = nodemailer.createTransport({
    host: konto.smtpHost,
    port: konto.smtpPort,
    secure: konto.smtpSecure,
    auth,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  transporterCache.set(konto.id, transporter);
  return transporter;
}

/**
 * Remove a cached transporter (e.g., when credentials change).
 */
export function invalidateTransport(kontoId: string): void {
  const existing = transporterCache.get(kontoId);
  if (existing) {
    existing.close();
    transporterCache.delete(kontoId);
    log.info({ kontoId }, "SMTP transport invalidated");
  }
}

/**
 * Close all cached transporters (graceful shutdown).
 */
export function closeAllTransports(): void {
  transporterCache.forEach((transporter, kontoId) => {
    try {
      transporter.close();
    } catch {
      // Ignore close errors during shutdown
    }
  });
  transporterCache.clear();
  log.info("All SMTP transports closed");
}
