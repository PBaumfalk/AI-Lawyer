import { prisma } from "@/lib/db";
import { addHours, format } from "date-fns";
import { createLogger } from "@/lib/logger";
import { createScannerAlert, resolveAlertRecipients } from "../service";

const log = createLogger("scanner:frist-check");

/**
 * FRIST_KRITISCH check: find Fristen within threshold hours that are
 * not erledigt and not quittiert on open Akten.
 *
 * Complements frist-reminder.ts (which handles Vorfrist/overdue notifications).
 * Scanner adds Alert-Center visibility + Socket.IO push for critical window.
 *
 * Uses a single batch query to avoid N+1 per-Akte queries.
 *
 * @param thresholdHours - Number of hours before Fristablauf to trigger alert (default: 48)
 * @returns Number of alerts created (excluding deduplicated ones)
 */
export async function runFristCheck(thresholdHours: number): Promise<number> {
  const now = new Date();
  const thresholdDate = addHours(now, thresholdHours);

  // Batch query: all critical Fristen in one query
  const criticalFristen = await prisma.kalenderEintrag.findMany({
    where: {
      typ: "FRIST",
      erledigt: false,
      quittiert: false,
      akte: { status: "OFFEN" },
      OR: [
        // Fristablauf is set and within threshold
        {
          fristablauf: {
            lte: thresholdDate,
            gte: now,
          },
        },
        // Fristablauf not set, use datum instead
        {
          fristablauf: null,
          datum: {
            lte: thresholdDate,
            gte: now,
          },
        },
      ],
    },
    include: {
      akte: {
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          anwaltId: true,
          sachbearbeiterId: true,
        },
      },
    },
  });

  log.info(
    { count: criticalFristen.length, thresholdHours },
    "Found critical Fristen within threshold"
  );

  let alertsCreated = 0;

  for (const frist of criticalFristen) {
    if (!frist.akte) continue;

    const recipients = await resolveAlertRecipients(frist.akte);
    const fristDatum = frist.fristablauf ?? frist.datum;
    const formattedDate = format(fristDatum, "dd.MM.yyyy HH:mm");

    for (const userId of recipients) {
      const alert = await createScannerAlert({
        akteId: frist.akte.id,
        userId,
        typ: "FRIST_KRITISCH",
        severity: 8,
        titel: `Kritische Frist: ${frist.titel} (${frist.akte.aktenzeichen})`,
        inhalt: `Fristablauf am ${formattedDate}. Akte: ${frist.akte.kurzrubrum ?? frist.akte.aktenzeichen}`,
        meta: {
          fristId: frist.id,
          fristablauf: fristDatum.toISOString(),
          kalenderEintragTitel: frist.titel,
        },
      });

      if (alert) alertsCreated++;
    }
  }

  log.info({ alertsCreated }, "Frist check completed");
  return alertsCreated;
}
