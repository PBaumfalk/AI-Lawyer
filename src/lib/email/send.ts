/**
 * Email Transport Helper
 *
 * Thin wrapper around nodemailer for SMTP email sending.
 * Returns boolean success/failure -- never throws.
 * Used for dual-channel delivery (in-app + email) of Frist reminders.
 */

import nodemailer from "nodemailer";
import { createLogger } from "@/lib/logger";

const log = createLogger("email");

/** Lazily created transporter (avoids connection at import time) */
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const host = process.env.SMTP_HOST ?? "localhost";
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user
        ? {
            user,
            pass: pass ?? "",
          }
        : undefined,
    });
  }
  return _transporter;
}

/**
 * Check if email sending is configured.
 * Returns true only when SMTP_HOST is a real server and SMTP_USER is set.
 */
export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST ?? "";
  const user = process.env.SMTP_USER ?? "";
  // Not configured if host is empty/localhost without a user
  if (!host || (host === "localhost" && !user)) return false;
  if (!user) return false;
  return true;
}

/**
 * Send an email via the configured SMTP transport.
 *
 * @returns true on success, false on failure (does NOT throw)
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    log.warn("Email not configured (SMTP_HOST/SMTP_USER missing), skipping");
    return false;
  }

  const from = process.env.SMTP_FROM ?? "noreply@kanzlei.local";

  try {
    await getTransporter().sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    log.info({ to: opts.to, subject: opts.subject }, "Email sent");
    return true;
  } catch (err) {
    log.error({ to: opts.to, subject: opts.subject, err }, "Failed to send email");
    return false;
  }
}
