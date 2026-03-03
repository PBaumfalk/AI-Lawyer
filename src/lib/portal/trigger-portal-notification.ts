/**
 * Portal Notification Trigger Helper
 *
 * Resolves all Mandant Kontakt IDs for a given Akte and dispatches
 * a portal email notification for each.
 *
 * Fire-and-forget: errors are logged but never thrown, so the calling
 * action (message send, document share, activity create) is never blocked.
 *
 * Requirements: MSG-04, MSG-05, MSG-06
 */

import { prisma } from "@/lib/db";
import {
  enqueuePortalNotification,
  type PortalNotificationJobData,
} from "@/lib/portal/portal-notification";
import { createLogger } from "@/lib/logger";

const log = createLogger("portal-trigger");

/**
 * Trigger a portal email notification for all Mandant-Beteiligte of an Akte.
 *
 * Fire-and-forget: errors are logged but never thrown, so the calling action
 * (message send, document share, activity create) is never blocked.
 *
 * @param akteId - The Akte to find Mandant Beteiligte for
 * @param type - The notification type
 * @param deepLinkPath - Portal-relative path (e.g. "/akten/{akteId}/nachrichten")
 * @param excludeKontaktId - Optional: skip this Kontakt (e.g. the message sender)
 */
export async function triggerPortalNotificationForAkte(
  akteId: string,
  type: PortalNotificationJobData["type"],
  deepLinkPath: string,
  excludeKontaktId?: string,
): Promise<void> {
  try {
    // Find all Mandant-Beteiligte for this Akte
    const beteiligte = await prisma.beteiligter.findMany({
      where: {
        akteId,
        rolle: "MANDANT",
        ...(excludeKontaktId ? { kontaktId: { not: excludeKontaktId } } : {}),
      },
      select: {
        kontaktId: true,
      },
    });

    if (beteiligte.length === 0) {
      log.debug(
        { akteId, type },
        "No Mandant Beteiligte found, skipping notification",
      );
      return;
    }

    for (const b of beteiligte) {
      await enqueuePortalNotification({
        type,
        mandantKontaktId: b.kontaktId,
        akteId,
        deepLinkPath,
      });
    }

    log.info(
      { akteId, type, mandantCount: beteiligte.length },
      "Portal notifications enqueued",
    );
  } catch (err) {
    // Fire-and-forget: never block the calling action
    log.warn(
      { err, akteId, type },
      "Failed to trigger portal notification (non-fatal)",
    );
  }
}
