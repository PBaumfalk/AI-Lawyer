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
