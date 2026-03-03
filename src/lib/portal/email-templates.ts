/**
 * Portal Email Templates
 *
 * Generates HTML + plain-text email content for Mandant portal notifications.
 * DSGVO-safe: NO case details, document names, or message content in emails.
 * Only generic event summaries with a deep-link to the portal.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type PortalEmailType =
  | "neue-nachricht"
  | "neues-dokument"
  | "sachstand-update";

export interface PortalEmailInput {
  type: PortalEmailType;
  /** Kanzlei display name (from SystemSetting or env) */
  kanzleiName: string;
  /** Portal base URL, e.g. "http://localhost:3000/portal" */
  portalBaseUrl: string;
  /** Deep-link path, e.g. "/akten/abc123/nachrichten" */
  deepLinkPath: string;
}

export interface PortalEmailOutput {
  subject: string;
  text: string;
  html: string;
}

// ─── Content per notification type ──────────────────────────────────────────

interface EmailContent {
  subjectSuffix: string;
  heading: string;
  body: string;
  ctaLabel: string;
}

const EMAIL_CONTENT: Record<PortalEmailType, EmailContent> = {
  "neue-nachricht": {
    subjectSuffix: "Neue Nachricht zu Ihrem Verfahren",
    heading: "Neue Nachricht",
    body: "Sie haben eine neue Nachricht von Ihrem Anwalt erhalten. Bitte melden Sie sich im Mandantenportal an, um die Nachricht zu lesen.",
    ctaLabel: "Nachricht lesen",
  },
  "neues-dokument": {
    subjectSuffix: "Neues Dokument in Ihrem Portal verfuegbar",
    heading: "Neues Dokument",
    body: "Ein neues Dokument wurde in Ihrem Mandantenportal bereitgestellt. Bitte melden Sie sich an, um das Dokument einzusehen.",
    ctaLabel: "Dokument ansehen",
  },
  "sachstand-update": {
    subjectSuffix: "Aktualisierung zu Ihrem Verfahren",
    heading: "Sachstand-Aktualisierung",
    body: "Es gibt eine Aktualisierung zu Ihrem Verfahren. Bitte melden Sie sich im Mandantenportal an, um die Details einzusehen.",
    ctaLabel: "Details ansehen",
  },
};

// ─── Renderer ───────────────────────────────────────────────────────────────

/**
 * Render a portal notification email in HTML + plain text.
 * DSGVO-safe: contains no case-specific details.
 */
export function renderPortalEmail(input: PortalEmailInput): PortalEmailOutput {
  const content = EMAIL_CONTENT[input.type];
  const deepLink = `${input.portalBaseUrl}${input.deepLinkPath}`;
  const subject = `[${input.kanzleiName}] ${content.subjectSuffix}`;

  // Plain text version
  const text = [
    `${content.heading}`,
    "",
    content.body,
    "",
    `${content.ctaLabel}: ${deepLink}`,
    "",
    "---",
    `${input.kanzleiName}`,
    "Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese E-Mail.",
  ].join("\n");

  // HTML version with inline styles for maximum email client compatibility
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e1b4b;padding:24px 32px;">
              <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                ${escapeHtml(input.kanzleiName)}
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">
                ${escapeHtml(content.heading)}
              </h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
                ${escapeHtml(content.body)}
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px;background-color:#4f46e5;">
                    <a href="${escapeHtml(deepLink)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${escapeHtml(content.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;text-align:center;">
                Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">
                ${escapeHtml(input.kanzleiName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escape HTML special characters to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
