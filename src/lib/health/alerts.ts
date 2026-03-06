import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { createLogger } from "@/lib/logger";
import { createRedisConnection } from "@/lib/redis";

const log = createLogger("health-alerts");

/**
 * Cooldown TTL in seconds (60 minutes).
 * Persisted in Redis so restarts do not reset the cooldown window.
 */
const COOLDOWN_TTL_SECONDS = 3600;

/**
 * In-memory fallback cooldown tracker.
 * Used only when Redis is unavailable — prevents email spam even without Redis.
 */
const fallbackCooldowns = new Map<string, number>();
const FALLBACK_COOLDOWN_MS = COOLDOWN_TTL_SECONDS * 1000;

interface ServiceCheckResult {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  error?: string;
}

/**
 * Persist a cooldown marker in Redis for a service.
 * Falls back to in-memory Map if Redis is unavailable.
 */
async function setCooldown(serviceName: string): Promise<void> {
  const key = `health:alert:cooldown:${serviceName}`;
  let redisConn: ReturnType<typeof createRedisConnection> | null = null;
  try {
    redisConn = createRedisConnection();
    await redisConn.set(key, "1", "EX", COOLDOWN_TTL_SECONDS);
  } catch (err) {
    log.warn({ err, service: serviceName }, "Redis unavailable for setCooldown — using in-memory fallback");
    fallbackCooldowns.set(serviceName, Date.now());
  } finally {
    if (redisConn) {
      try { redisConn.disconnect(); } catch { /* ignore */ }
    }
  }
}

/**
 * Check if a cooldown is active for a service.
 * Returns true if cooldown is active (suppress alert), false if alert should be sent.
 * Falls back to in-memory Map if Redis is unavailable.
 */
async function hasCooldown(serviceName: string): Promise<boolean> {
  const key = `health:alert:cooldown:${serviceName}`;
  let redisConn: ReturnType<typeof createRedisConnection> | null = null;
  try {
    redisConn = createRedisConnection();
    const val = await redisConn.get(key);
    return val !== null;
  } catch (err) {
    log.warn({ err, service: serviceName }, "Redis unavailable for hasCooldown — using in-memory fallback");
    const lastTime = fallbackCooldowns.get(serviceName);
    if (!lastTime) return false;
    return Date.now() - lastTime < FALLBACK_COOLDOWN_MS;
  } finally {
    if (redisConn) {
      try { redisConn.disconnect(); } catch { /* ignore */ }
    }
  }
}

/**
 * Send email alerts to all ADMIN users when services are unhealthy.
 * Respects 60-minute cooldown per service, persisted in Redis.
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
  const cooldownChecks = await Promise.all(
    unhealthy.map(async (s) => ({ service: s, onCooldown: await hasCooldown(s.name) }))
  );
  const toAlert = cooldownChecks
    .filter((c) => !c.onCooldown)
    .map((c) => c.service);

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

    await setCooldown(service.name);
    log.warn({ service: service.name, error: service.error }, "Health alert sent for unhealthy service");
  }

  return {
    alertsSent,
    servicesDown: unhealthy.map((s) => s.name),
  };
}
