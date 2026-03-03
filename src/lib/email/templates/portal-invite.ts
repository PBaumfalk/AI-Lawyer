/**
 * Email template for portal invitation.
 *
 * Sent when an Anwalt invites a Mandant-Beteiligter
 * to activate their portal account.
 */

interface PortalInviteEmailParams {
  mandantName: string;
  kanzleiName: string;
  aktenzeichen: string;
  activationUrl: string;
}

/**
 * Generate subject, text, and HTML for the portal invitation email.
 */
export function portalInviteEmail(params: PortalInviteEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const { mandantName, kanzleiName, aktenzeichen, activationUrl } = params;

  const subject = `Einladung zum Mandantenportal — ${kanzleiName}`;

  const text = [
    `Guten Tag ${mandantName},`,
    "",
    `die Kanzlei ${kanzleiName} laedt Sie ein, das Mandantenportal zu nutzen.`,
    "",
    `Ueber das Portal koennen Sie den Fortschritt Ihrer Akte (Az. ${aktenzeichen}) einsehen,`,
    "freigegebene Dokumente herunterladen und sicher mit Ihrer Kanzlei kommunizieren.",
    "",
    "Bitte aktivieren Sie Ihren Zugang ueber den folgenden Link:",
    activationUrl,
    "",
    "Dieser Link ist 7 Tage gueltig. Falls er ablaeuft, kann Ihre Kanzlei",
    "Ihnen eine neue Einladung zusenden.",
    "",
    "Bei Fragen wenden Sie sich bitte direkt an Ihre Kanzlei.",
    "",
    "Mit freundlichen Gruessen",
    kanzleiName,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${kanzleiName}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Mandantenportal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.6;">
                Guten Tag <strong>${mandantName}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
                die Kanzlei <strong>${kanzleiName}</strong> laedt Sie ein, das Mandantenportal zu nutzen.
                Ueber das Portal koennen Sie den Fortschritt Ihrer Akte einsehen, freigegebene
                Dokumente herunterladen und sicher mit Ihrer Kanzlei kommunizieren.
              </p>
              <p style="margin:0 0 8px;color:#71717a;font-size:13px;">
                Aktenzeichen: <strong style="color:#3f3f46;">${aktenzeichen}</strong>
              </p>
              <div style="margin:24px 0;text-align:center;">
                <a href="${activationUrl}"
                   style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
                  Portal-Zugang aktivieren
                </a>
              </div>
              <p style="margin:0 0 8px;color:#a1a1aa;font-size:13px;text-align:center;">
                Dieser Link ist <strong>7 Tage</strong> gueltig.
              </p>
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">
                Falls Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.
                Bei Fragen wenden Sie sich bitte direkt an Ihre Kanzlei.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:20px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                Mit freundlichen Gruessen &mdash; ${kanzleiName}
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
