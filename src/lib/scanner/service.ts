import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/service";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { subHours, subDays } from "date-fns";
import { Prisma } from "@prisma/client";
import type { HelenaAlert } from "@prisma/client";
import type { CheckResult } from "./types";

const log = createLogger("scanner-service");

// ---------------------------------------------------------------------------
// Alert Creation with Deduplication
// ---------------------------------------------------------------------------

/**
 * Create a scanner alert with 24h deduplication.
 * Returns the alert if created, or null if suppressed by dedup.
 *
 * Also creates an AktenActivity with typ HELENA_ALERT for feed integration,
 * emits Socket.IO badge count update, and for FRIST_KRITISCH additionally
 * sends a critical push + notification (but NOT email -- frist-reminder.ts
 * handles email for upcoming/overdue Fristen).
 */
export async function createScannerAlert(
  params: CheckResult
): Promise<HelenaAlert | null> {
  // --- Dedup check: same alert type + same Akte within 24h ---
  const existing = await prisma.helenaAlert.findFirst({
    where: {
      akteId: params.akteId,
      typ: params.typ,
      createdAt: { gte: subHours(new Date(), 24) },
    },
  });

  if (existing) {
    log.debug(
      { akteId: params.akteId, typ: params.typ, existingId: existing.id },
      "Alert deduplicated (same type + Akte within 24h)"
    );
    return null;
  }

  // --- Create alert ---
  const alert = await prisma.helenaAlert.create({
    data: {
      akteId: params.akteId,
      userId: params.userId,
      typ: params.typ,
      titel: params.titel,
      inhalt: params.inhalt ?? null,
      severity: params.severity,
      prioritaet: params.severity,
      meta: (params.meta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  // --- Create AktenActivity for feed integration (ALRT-03) ---
  await prisma.aktenActivity.create({
    data: {
      akteId: params.akteId,
      // userId is null for scanner-generated events
      typ: "HELENA_ALERT",
      titel: params.titel,
      inhalt: params.inhalt ?? null,
      meta: {
        alertId: alert.id,
        alertTyp: params.typ,
        severity: params.severity,
      },
    },
  });

  // --- Socket.IO badge count update for all alert types ---
  try {
    const unreadCount = await prisma.helenaAlert.count({
      where: { userId: params.userId, gelesen: false },
    });

    getSocketEmitter()
      .to(`user:${params.userId}`)
      .emit("helena:alert-badge", { count: unreadCount });
  } catch (err) {
    log.warn({ err, userId: params.userId }, "Failed to emit alert badge count");
  }

  // --- FRIST_KRITISCH: additional critical push + notification ---
  if (params.typ === "FRIST_KRITISCH") {
    try {
      getSocketEmitter()
        .to(`user:${params.userId}`)
        .emit("helena:alert-critical", {
          alertId: alert.id,
          akteId: params.akteId,
          typ: params.typ,
          titel: params.titel,
        });

      await createNotification({
        userId: params.userId,
        type: "helena:alert-critical",
        title: params.titel,
        message:
          params.inhalt ??
          "Kritische Frist erfordert sofortige Aufmerksamkeit.",
        data: {
          alertId: alert.id,
          akteId: params.akteId,
          link: `/akten/${params.akteId}`,
        },
      });
    } catch (err) {
      log.warn(
        { err, alertId: alert.id },
        "Failed to send FRIST_KRITISCH notification (non-fatal)"
      );
    }
  }

  log.info(
    { alertId: alert.id, akteId: params.akteId, typ: params.typ, severity: params.severity },
    "Scanner alert created"
  );

  return alert;
}

// ---------------------------------------------------------------------------
// Vertreter Routing Helper
// ---------------------------------------------------------------------------

/**
 * Resolve alert recipient: Akte Verantwortlicher (anwaltId || sachbearbeiterId).
 * When Verantwortlicher is on vacation, also notify Vertreter.
 * Returns array of userIds to alert.
 */
export async function resolveAlertRecipients(akte: {
  anwaltId: string | null;
  sachbearbeiterId: string | null;
}): Promise<string[]> {
  const primaryId = akte.anwaltId ?? akte.sachbearbeiterId;
  if (!primaryId) return [];

  const user = await prisma.user.findUnique({
    where: { id: primaryId },
    select: {
      id: true,
      vertretungAktiv: true,
      vertretungVon: true,
      vertretungBis: true,
      vertreterId: true,
    },
  });

  if (!user) return [];

  const recipients = [user.id];

  // Check if user is on vacation and has a Vertreter
  if (
    user.vertretungAktiv &&
    user.vertreterId &&
    user.vertretungVon &&
    user.vertretungBis
  ) {
    const now = new Date();
    if (now >= user.vertretungVon && now <= user.vertretungBis) {
      recipients.push(user.vertreterId);
    }
  }

  return recipients;
}

// ---------------------------------------------------------------------------
// Auto-Resolve: mark alerts as resolved when underlying condition is fixed
// ---------------------------------------------------------------------------

/**
 * Auto-resolve stale alerts whose underlying condition has been fixed.
 * Checks all 4 alert types and marks them resolved with resolvedAt + resolvedReason in meta.
 * Returns total count of resolved alerts.
 */
export async function resolveStaleAlerts(): Promise<number> {
  let totalResolved = 0;

  // --- FRIST_KRITISCH: resolve if KalenderEintrag is now erledigt or quittiert ---
  try {
    const fristAlerts = await prisma.helenaAlert.findMany({
      where: {
        typ: "FRIST_KRITISCH",
        gelesen: false,
      },
    });

    for (const alert of fristAlerts) {
      const meta = (alert.meta as Record<string, unknown>) ?? {};
      if (meta.resolvedAt) continue; // Already auto-resolved

      const fristId = meta.fristId as string | undefined;
      if (!fristId) continue;

      const frist = await prisma.kalenderEintrag.findUnique({
        where: { id: fristId },
        select: { erledigt: true, quittiert: true },
      });

      if (!frist) continue;

      if (frist.erledigt || frist.quittiert) {
        const reason = frist.erledigt ? "Frist erledigt" : "Frist quittiert";
        await prisma.helenaAlert.update({
          where: { id: alert.id },
          data: {
            gelesen: true,
            gelesenAt: new Date(),
            meta: { ...meta, resolvedAt: new Date().toISOString(), resolvedReason: reason },
          },
        });
        totalResolved++;
        log.debug({ alertId: alert.id, reason }, "FRIST_KRITISCH auto-resolved");
      }
    }
  } catch (err) {
    log.error({ err }, "Error resolving FRIST_KRITISCH alerts");
  }

  // --- AKTE_INAKTIV: resolve if Akte now has recent activity ---
  try {
    const inaktivAlerts = await prisma.helenaAlert.findMany({
      where: {
        typ: "AKTE_INAKTIV",
        gelesen: false,
      },
    });

    for (const alert of inaktivAlerts) {
      const meta = (alert.meta as Record<string, unknown>) ?? {};
      if (meta.resolvedAt) continue;

      // Check for new activity after the alert was created
      const [docCount, emailCount, chatCount] = await Promise.all([
        prisma.dokument.count({
          where: { akteId: alert.akteId, createdAt: { gt: alert.createdAt } },
        }),
        prisma.emailMessage.count({
          where: { akteId: alert.akteId, empfangenAm: { gt: alert.createdAt } },
        }),
        prisma.chatNachricht.count({
          where: { akteId: alert.akteId, createdAt: { gt: alert.createdAt } },
        }),
      ]);

      if (docCount > 0 || emailCount > 0 || chatCount > 0) {
        await prisma.helenaAlert.update({
          where: { id: alert.id },
          data: {
            gelesen: true,
            gelesenAt: new Date(),
            meta: {
              ...meta,
              resolvedAt: new Date().toISOString(),
              resolvedReason: "Neue Aktivitaet erkannt",
            },
          },
        });
        totalResolved++;
        log.debug({ alertId: alert.id }, "AKTE_INAKTIV auto-resolved");
      }
    }
  } catch (err) {
    log.error({ err }, "Error resolving AKTE_INAKTIV alerts");
  }

  // --- BETEILIGTE_FEHLEN: resolve if Akte now has both Mandant and Gegner ---
  try {
    const beteiligteAlerts = await prisma.helenaAlert.findMany({
      where: {
        typ: "BETEILIGTE_FEHLEN",
        gelesen: false,
      },
    });

    for (const alert of beteiligteAlerts) {
      const meta = (alert.meta as Record<string, unknown>) ?? {};
      if (meta.resolvedAt) continue;

      const beteiligte = await prisma.beteiligter.findMany({
        where: { akteId: alert.akteId },
        select: { rolle: true },
      });

      const roles = new Set(beteiligte.map((b) => b.rolle));
      const hasMandant = roles.has("MANDANT");
      const hasGegner = roles.has("GEGNER");

      // Check if the previously missing roles are now present
      const missingRoles = (meta.missingRoles as string[]) ?? [];
      const allPresent = missingRoles.every((role) => {
        if (role === "Mandant") return hasMandant;
        if (role === "Gegner") return hasGegner;
        return false;
      });

      if (allPresent) {
        await prisma.helenaAlert.update({
          where: { id: alert.id },
          data: {
            gelesen: true,
            gelesenAt: new Date(),
            meta: {
              ...meta,
              resolvedAt: new Date().toISOString(),
              resolvedReason: "Beteiligte ergaenzt",
            },
          },
        });
        totalResolved++;
        log.debug({ alertId: alert.id }, "BETEILIGTE_FEHLEN auto-resolved");
      }
    }
  } catch (err) {
    log.error({ err }, "Error resolving BETEILIGTE_FEHLEN alerts");
  }

  // --- DOKUMENT_FEHLT: resolve if expected documents now exist ---
  try {
    const dokumentAlerts = await prisma.helenaAlert.findMany({
      where: {
        typ: "DOKUMENT_FEHLT",
        gelesen: false,
      },
    });

    for (const alert of dokumentAlerts) {
      const meta = (alert.meta as Record<string, unknown>) ?? {};
      if (meta.resolvedAt) continue;

      const missingDocs = (meta.missingDocs as string[]) ?? [];
      if (missingDocs.length === 0) continue;

      const dokumente = await prisma.dokument.findMany({
        where: { akteId: alert.akteId },
        select: { name: true },
      });

      const docNames = dokumente.map((d) => d.name.toLowerCase());

      // Check if all previously missing docs now exist
      const stillMissing = missingDocs.filter((expected) => {
        const expectedLower = expected.toLowerCase();
        // Vollmacht special case: match "vollmacht" in name
        return !docNames.some((name) => name.includes(expectedLower));
      });

      if (stillMissing.length === 0) {
        await prisma.helenaAlert.update({
          where: { id: alert.id },
          data: {
            gelesen: true,
            gelesenAt: new Date(),
            meta: {
              ...meta,
              resolvedAt: new Date().toISOString(),
              resolvedReason: "Dokument hochgeladen",
            },
          },
        });
        totalResolved++;
        log.debug({ alertId: alert.id }, "DOKUMENT_FEHLT auto-resolved");
      }
    }
  } catch (err) {
    log.error({ err }, "Error resolving DOKUMENT_FEHLT alerts");
  }

  if (totalResolved > 0) {
    log.info({ totalResolved }, "Auto-resolved stale alerts");
  }

  return totalResolved;
}

// ---------------------------------------------------------------------------
// Progressive Escalation
// ---------------------------------------------------------------------------

/**
 * Escalate unresolved alerts based on age.
 *
 * - 3-day escalation (severityBump > 0): bump severity + prioritaet by severityBump (clamped to 10)
 * - 7-day escalation (severityBump === 0): notify all ADMIN users
 *
 * Checks meta for escalatedAt3d/escalatedAt7d to avoid re-escalation.
 * Returns count of escalated alerts.
 */
export async function escalateUnresolved(
  daysThreshold: number,
  severityBump: number
): Promise<number> {
  let escalatedCount = 0;
  const escalationKey = daysThreshold <= 3 ? "escalatedAt3d" : "escalatedAt7d";

  const alerts = await prisma.helenaAlert.findMany({
    where: {
      gelesen: false,
      createdAt: { lt: subDays(new Date(), daysThreshold) },
    },
  });

  for (const alert of alerts) {
    const meta = (alert.meta as Record<string, unknown>) ?? {};

    // Skip if already auto-resolved or already escalated at this level
    if (meta.resolvedAt) continue;
    if (meta[escalationKey]) continue;

    if (severityBump > 0) {
      // 3-day escalation: bump severity
      await prisma.helenaAlert.update({
        where: { id: alert.id },
        data: {
          severity: Math.min(10, alert.severity + severityBump),
          prioritaet: Math.min(10, alert.prioritaet + severityBump),
          meta: { ...meta, [escalationKey]: new Date().toISOString() },
        },
      });
      escalatedCount++;
      log.debug(
        { alertId: alert.id, newSeverity: Math.min(10, alert.severity + severityBump) },
        `Alert escalated (+${severityBump} severity after ${daysThreshold}d)`
      );
    } else {
      // 7-day escalation: notify admins
      await prisma.helenaAlert.update({
        where: { id: alert.id },
        data: {
          meta: { ...meta, [escalationKey]: new Date().toISOString() },
        },
      });

      // Find all ADMIN users and send notification
      try {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", aktiv: true },
          select: { id: true },
        });

        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: "scanner:admin-escalation",
            title: `Unbehandelte Warnung: ${alert.titel}`,
            message: `Alert seit ${daysThreshold}+ Tagen unbehandelt in Akte.`,
            data: {
              alertId: alert.id,
              akteId: alert.akteId,
              link: `/akten/${alert.akteId}`,
            },
          });
        }
      } catch (err) {
        log.warn(
          { err, alertId: alert.id },
          "Failed to send admin escalation notification"
        );
      }

      escalatedCount++;
      log.debug(
        { alertId: alert.id },
        `Alert escalated (admin notification after ${daysThreshold}d)`
      );
    }
  }

  if (escalatedCount > 0) {
    log.info({ escalatedCount, daysThreshold, severityBump }, "Escalated unresolved alerts");
  }

  return escalatedCount;
}
