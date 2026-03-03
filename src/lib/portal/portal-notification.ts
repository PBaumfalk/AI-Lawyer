/**
 * Portal Notification Service
 *
 * Dispatches and processes email notifications for Mandant portal events.
 * - Enqueue: deduplicating job dispatch (1 email per type/mandant/akte per day)
 * - Process: DSGVO einwilligungEmail gate, email rendering, SMTP send, audit log
 *
 * Requirements: MSG-04, MSG-05, MSG-06
 */

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderPortalEmail, type PortalEmailType } from "@/lib/portal/email-templates";
import { getSettingTyped } from "@/lib/settings/service";
import { logAuditEvent } from "@/lib/audit";
import { portalNotificationQueue } from "@/lib/queue/queues";

const log = createLogger("portal-notification");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PortalNotificationJobData {
  type: PortalEmailType;
  /** Kontakt.id to look up email + einwilligungEmail */
  mandantKontaktId: string;
  /** Akte.id for audit trail */
  akteId: string;
  /** Deep-link path, e.g. "/akten/{akteId}/nachrichten" */
  deepLinkPath: string;
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

/**
 * Enqueue a portal email notification job with deduplication.
 * JobId includes a date key to prevent duplicate emails for the same
 * event type + mandant + akte within 24 hours.
 */
export async function enqueuePortalNotification(
  data: PortalNotificationJobData
): Promise<void> {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const jobId = `portal-${data.type}-${data.mandantKontaktId}-${data.akteId}-${dateKey}`;

  await portalNotificationQueue.add(`portal-email-${data.type}`, data, {
    jobId,
  });

  log.info(
    { type: data.type, mandantKontaktId: data.mandantKontaktId, akteId: data.akteId, jobId },
    "Portal notification enqueued"
  );
}

// ─── Processor ──────────────────────────────────────────────────────────────

/**
 * Process a portal notification job:
 * 1. Look up Kontakt for email + DSGVO consent
 * 2. Gate on einwilligungEmail consent
 * 3. Render email template
 * 4. Send via SMTP
 * 5. Audit log
 */
export async function processPortalNotification(
  data: PortalNotificationJobData
): Promise<void> {
  const { type, mandantKontaktId, akteId, deepLinkPath } = data;

  // 1. Look up Kontakt
  const kontakt = await prisma.kontakt.findUnique({
    where: { id: mandantKontaktId },
    select: {
      id: true,
      email: true,
      einwilligungEmail: true,
      vorname: true,
      nachname: true,
    },
  });

  if (!kontakt) {
    log.warn({ mandantKontaktId }, "Kontakt not found, skipping notification");
    return;
  }

  // 2. DSGVO gate: einwilligungEmail must be true
  if (!kontakt.einwilligungEmail) {
    log.info(
      { mandantKontaktId, type },
      "DSGVO gate: einwilligungEmail=false, skipping email"
    );
    return;
  }

  // 3. Check email exists
  if (!kontakt.email) {
    log.info(
      { mandantKontaktId, type },
      "No email on Kontakt, skipping notification"
    );
    return;
  }

  // 4. Check SMTP is configured
  if (!isEmailConfigured()) {
    log.warn(
      { type, mandantKontaktId },
      "SMTP not configured, skipping portal email"
    );
    return;
  }

  // 5. Get Kanzlei name from settings
  const kanzleiName = await getSettingTyped<string>(
    "kanzlei.name",
    process.env.SMTP_FROM ?? "Kanzlei"
  );

  // 6. Build portal base URL
  const baseUrl = process.env.PORTAL_BASE_URL
    ?? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/portal`;

  // 7. Render email
  const email = renderPortalEmail({
    type,
    kanzleiName,
    portalBaseUrl: baseUrl,
    deepLinkPath,
  });

  // 8. Send email
  const sent = await sendEmail({
    to: kontakt.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (sent) {
    log.info(
      { type, mandantKontaktId, to: kontakt.email },
      "Portal notification email sent"
    );
  } else {
    log.error(
      { type, mandantKontaktId, to: kontakt.email },
      "Portal notification email failed to send"
    );
    // Throw to trigger BullMQ retry
    throw new Error(`Failed to send portal email to ${kontakt.email}`);
  }

  // 9. Audit log
  await logAuditEvent({
    akteId,
    aktion: "PORTAL_EMAIL_GESENDET",
    details: {
      type,
      mandantKontaktId,
      to: kontakt.email,
    },
  });
}
