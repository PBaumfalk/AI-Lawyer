import { prisma } from "@/lib/db";
import { subDays, format } from "date-fns";
import { createLogger } from "@/lib/logger";
import { createScannerAlert, resolveAlertRecipients } from "../service";

const log = createLogger("scanner:inaktiv-check");

/**
 * AKTE_INAKTIV check: open Akten with no new documents, emails,
 * or notes within thresholdDays.
 *
 * Uses a batch query with _count to avoid N+1 per-Akte queries.
 *
 * @param thresholdDays - Number of days of inactivity before triggering alert (default: 14)
 * @returns Number of alerts created (excluding deduplicated ones)
 */
export async function runInaktivCheck(thresholdDays: number): Promise<number> {
  const thresholdDate = subDays(new Date(), thresholdDays);

  // Batch query with _count for activity detection
  const akten = await prisma.akte.findMany({
    where: {
      status: "OFFEN",
      geaendert: { lt: thresholdDate },
    },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      anwaltId: true,
      sachbearbeiterId: true,
      geaendert: true,
      _count: {
        select: {
          dokumente: {
            where: { createdAt: { gte: thresholdDate } },
          },
          emailMessages: {
            where: { empfangenAm: { gte: thresholdDate } },
          },
          chatNachrichten: {
            where: { createdAt: { gte: thresholdDate } },
          },
        },
      },
    },
  });

  // Filter: keep only truly inactive Akten (all 3 counts are 0)
  const inactiveAkten = akten.filter(
    (a) =>
      a._count.dokumente === 0 &&
      a._count.emailMessages === 0 &&
      a._count.chatNachrichten === 0
  );

  log.info(
    { total: akten.length, inactive: inactiveAkten.length, thresholdDays },
    "Found inactive Akten"
  );

  let alertsCreated = 0;

  for (const akte of inactiveAkten) {
    const recipients = await resolveAlertRecipients(akte);
    const formattedDate = format(akte.geaendert, "dd.MM.yyyy");

    for (const userId of recipients) {
      const alert = await createScannerAlert({
        akteId: akte.id,
        userId,
        typ: "AKTE_INAKTIV",
        severity: 4,
        titel: `Inaktive Akte: ${akte.aktenzeichen}`,
        inhalt: `Keine Aktivitaet seit ${thresholdDays} Tagen. Letzte Aenderung: ${formattedDate}`,
        meta: {
          lastActivity: akte.geaendert.toISOString(),
          thresholdDays,
        },
      });

      if (alert) alertsCreated++;
    }
  }

  log.info({ alertsCreated }, "Inaktiv check completed");
  return alertsCreated;
}
