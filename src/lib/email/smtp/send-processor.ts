/**
 * BullMQ processor for the email-send queue.
 * Loads EmailNachricht, gets sender EmailKonto, creates transport,
 * sends via nodemailer, updates send status, stores in IMAP Sent folder.
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { createSmtpTransport } from "@/lib/email/smtp/transport-factory";
import { createNotification } from "@/lib/notifications/service";
import type { EmailSendJob } from "@/lib/email/types";

const log = createLogger("smtp:send");

/**
 * Process an email send job.
 *
 * Steps:
 * 1. Load EmailNachricht and sender EmailKonto
 * 2. Build email with signature injection
 * 3. Send via nodemailer SMTP
 * 4. Update status to GESENDET or FEHLGESCHLAGEN
 * 5. Attempt to store in IMAP Sent folder via APPEND
 */
export async function emailSendProcessor(
  job: Job<EmailSendJob>
): Promise<{ status: string; messageId?: string }> {
  const { emailNachrichtId, kontoId, userId } = job.data;

  log.info(
    { jobId: job.id, emailNachrichtId, kontoId },
    "Processing email send job"
  );

  // Update status to sending
  await prisma.emailNachricht.update({
    where: { id: emailNachrichtId },
    data: { sendeStatus: "WIRD_GESENDET" },
  });

  try {
    // Load the email
    const email = await prisma.emailNachricht.findUnique({
      where: { id: emailNachrichtId },
      include: {
        anhaenge: true,
      },
    });

    if (!email) {
      throw new Error(`EmailNachricht ${emailNachrichtId} nicht gefunden`);
    }

    // Load the sender account
    const konto = await prisma.emailKonto.findUnique({
      where: { id: kontoId },
    });

    if (!konto) {
      throw new Error(`EmailKonto ${kontoId} nicht gefunden`);
    }

    // Build email body with signature injection
    let htmlBody = email.inhalt ?? "";

    // Inject kanzlei signature if template exists
    if (konto.signaturVorlage) {
      const signature = await renderSignature(konto.signaturVorlage, userId);
      if (signature) {
        htmlBody = `${htmlBody}<br/><br/>--<br/>${signature}`;
      }
    }

    // Create SMTP transport
    const transporter = createSmtpTransport(konto);

    // Build attachments from MinIO
    const attachments = email.anhaenge.map((att) => ({
      filename: att.dateiname,
      path: att.speicherPfad, // nodemailer handles MinIO URLs if configured
      contentType: att.mimeType,
      cid: att.contentId ?? undefined,
    }));

    // Build email headers
    const mailOptions: any = {
      from: `${konto.name} <${konto.emailAdresse}>`,
      to: email.empfaenger.join(", "),
      cc: email.cc.length > 0 ? email.cc.join(", ") : undefined,
      bcc: email.bcc.length > 0 ? email.bcc.join(", ") : undefined,
      subject: email.betreff,
      html: htmlBody,
      text: email.inhaltText ?? undefined,
      attachments,
    };

    // Set priority headers
    if (email.prioritaet === "HOCH") {
      mailOptions.priority = "high";
      mailOptions.headers = { "X-Priority": "1" };
    } else if (email.prioritaet === "NIEDRIG") {
      mailOptions.priority = "low";
      mailOptions.headers = { "X-Priority": "5" };
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    log.info(
      { jobId: job.id, emailNachrichtId, smtpMessageId: info.messageId },
      "Email sent successfully"
    );

    // Update status to sent
    await prisma.emailNachricht.update({
      where: { id: emailNachrichtId },
      data: {
        sendeStatus: "GESENDET",
        gesendetAm: new Date(),
        messageId: info.messageId ?? email.messageId,
      },
    });

    return { status: "GESENDET", messageId: info.messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    log.error(
      { jobId: job.id, emailNachrichtId, err: errMsg },
      "Email send failed"
    );

    // Update status to failed
    await prisma.emailNachricht.update({
      where: { id: emailNachrichtId },
      data: {
        sendeStatus: "FEHLGESCHLAGEN",
        sendeFehler: errMsg,
      },
    });

    // Notify sender of failure
    try {
      const failedEmail = await prisma.emailNachricht.findUnique({
        where: { id: emailNachrichtId },
        select: { betreff: true },
      });
      await createNotification({
        userId,
        type: "email:send-failed",
        title: "E-Mail-Versand fehlgeschlagen",
        message: `Die E-Mail "${failedEmail?.betreff ?? "Unbekannt"}" konnte nicht gesendet werden: ${errMsg}`,
        data: { emailNachrichtId, kontoId },
      });
    } catch {
      // Non-fatal: notification failure
    }

    throw err; // Re-throw for BullMQ retry logic
  }
}

/**
 * Render a signature template by replacing {{placeholders}} with user data.
 */
async function renderSignature(
  template: string,
  userId: string
): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, telefon: true, position: true },
    });

    if (!user) return null;

    let rendered = template;
    rendered = rendered.replace(/\{\{name\}\}/gi, user.name ?? "");
    rendered = rendered.replace(/\{\{email\}\}/gi, user.email ?? "");
    rendered = rendered.replace(/\{\{telefon\}\}/gi, user.telefon ?? "");
    rendered = rendered.replace(/\{\{position\}\}/gi, user.position ?? "");
    rendered = rendered.replace(/\{\{titel\}\}/gi, user.position ?? "");
    rendered = rendered.replace(/\{\{durchwahl\}\}/gi, user.telefon ?? "");
    rendered = rendered.replace(/\{\{mobil\}\}/gi, "");

    return rendered;
  } catch {
    return null;
  }
}

/**
 * Email sync processor for on-demand sync jobs (triggered via API).
 */
export async function emailSyncProcessor(
  job: Job<{ kontoId: string; folder?: string }>
): Promise<{ status: string }> {
  const { kontoId, folder } = job.data;

  log.info({ jobId: job.id, kontoId, folder }, "Processing email sync job");

  // The actual sync is handled by the IMAP connection manager
  // This processor just triggers a sync for on-demand requests
  const { getManagedConnection } = await import("@/lib/email/imap/connection-manager");
  const { syncMailbox } = await import("@/lib/email/imap/sync");

  const managed = getManagedConnection(kontoId);
  if (!managed || !managed.client.usable) {
    throw new Error(`Keine aktive IMAP-Verbindung für Konto ${kontoId}`);
  }

  const result = await syncMailbox(
    managed.client,
    kontoId,
    folder ?? "INBOX"
  );

  // Update last sync time
  await prisma.emailKonto.update({
    where: { id: kontoId },
    data: { letzterSync: new Date() },
  });

  return { status: `${result.newMessages} neue Nachrichten synchronisiert` };
}
