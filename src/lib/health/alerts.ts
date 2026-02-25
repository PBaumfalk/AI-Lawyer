import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-alerts");

/**
 * In-memory cooldown tracker.
 * Maps service name to last alert timestamp (epoch ms).
 * 60-minute cooldown per service to prevent email spam.
 */
const lastAlertTime = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

interface ServiceCheckResult {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  error?: string;
}

/**
 * Check if an alert should be sent for a given service (respects cooldown).
 */
function shouldAlert(serviceName: string): boolean {
  const lastTime = lastAlertTime.get(serviceName);
  if (!lastTime) return true;
  return Date.now() - lastTime >= COOLDOWN_MS;
}

/**
 * Record that an alert was sent for a service.
 */
function recordAlert(serviceName: string): void {
  lastAlertTime.set(serviceName, Date.now());
}

/**
 * Send email alerts to all ADMIN users when services are unhealthy.
 * Respects 60-minute cooldown per service.
 *
 * Can be called from the health endpoint, admin page load, or a periodic BullMQ cron.
 */
export async function checkAndAlertHealthStatus(
  serviceResults: ServiceCheckResult[]
): Promise<{ alertsSent: number; servicesDown: string[] }> {
  const unhealthy = serviceResults.filter((s) => s.status === "unhealthy");

  if (unhealthy.length === 0) {
    return { alertsSent: 0, servicesDown: [] };
  }

  // Filter to only services that haven't been alerted recently
  const toAlert = unhealthy.filter((s) => shouldAlert(s.name));
  if (toAlert.length === 0) {
    return {
      alertsSent: 0,
      servicesDown: unhealthy.map((s) => s.name),
    };
  }

  // Get admin email addresses
  let adminEmails: string[] = [];
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", aktiv: true },
      select: { email: true },
    });
    adminEmails = admins.map((a) => a.email);
  } catch (err) {
    log.error({ err }, "Failed to fetch admin emails for health alerts");
    return { alertsSent: 0, servicesDown: unhealthy.map((s) => s.name) };
  }

  if (adminEmails.length === 0) {
    log.warn("No active admin users found for health alerts");
    return { alertsSent: 0, servicesDown: unhealthy.map((s) => s.name) };
  }

  let alertsSent = 0;
  const now = new Date().toLocaleString("de-DE");

  for (const service of toAlert) {
    const subject = `[AI-Lawyer] Service nicht erreichbar: ${service.name}`;
    const text = [
      `Service ${service.name} ist nicht erreichbar seit ${now}.`,
      service.error ? `Fehler: ${service.error}` : "",
      "",
      "Bitte pruefen Sie den Service-Status im Admin-Bereich unter /admin/system.",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #e11d48;">Service nicht erreichbar</h2>
        <p><strong>Service:</strong> ${service.name}</p>
        <p><strong>Zeitpunkt:</strong> ${now}</p>
        ${service.error ? `<p><strong>Fehler:</strong> ${service.error}</p>` : ""}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="color: #64748b; font-size: 12px;">
          Pruefen Sie den Status unter <a href="/admin/system">/admin/system</a>
        </p>
      </div>
    `;

    for (const email of adminEmails) {
      const sent = await sendEmail({ to: email, subject, text, html });
      if (sent) alertsSent++;
    }

    recordAlert(service.name);
    log.warn({ service: service.name, error: service.error }, "Health alert sent for unhealthy service");
  }

  return {
    alertsSent,
    servicesDown: unhealthy.map((s) => s.name),
  };
}
