/**
 * Frist Reminder Worker Processor
 *
 * Checks for upcoming deadlines and sends reminder notifications.
 * Considers Vertretung: when Verantwortlicher is on vacation,
 * notifications route to their Vertreter.
 *
 * Auto-deactivates expired Vertretung periods.
 */

import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { createLogger } from "@/lib/logger";

const log = createLogger("frist-reminder");

/**
 * Check if a user is currently on vacation (Vertretung active and within period).
 */
function isUserOnVacation(user: {
  vertretungAktiv: boolean;
  vertretungVon: Date | null;
  vertretungBis: Date | null;
}): boolean {
  if (!user.vertretungAktiv) return false;
  const now = new Date();
  const von = user.vertretungVon;
  const bis = user.vertretungBis;
  // If no period set but active, treat as on vacation
  if (!von && !bis) return true;
  if (von && now < von) return false;
  if (bis && now > bis) return false;
  return true;
}

/**
 * Auto-deactivate expired Vertretung periods.
 * Called at the start of each reminder run.
 */
async function deactivateExpiredVertretungen(): Promise<number> {
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: {
      vertretungAktiv: true,
      vertretungBis: { lt: now },
    },
    data: { vertretungAktiv: false },
  });

  if (result.count > 0) {
    log.info(
      { count: result.count },
      "Auto-deactivated expired Vertretungen"
    );
  }

  return result.count;
}

/**
 * Send Vorfrist notification, routing to Vertreter if user is on vacation.
 */
async function sendVorfristNotification(
  eintrag: {
    id: string;
    titel: string;
    datum: Date;
    fristablauf: Date | null;
    akteId: string | null;
  },
  verantwortlicher: {
    id: string;
    name: string;
    vertretungAktiv: boolean;
    vertretungVon: Date | null;
    vertretungBis: Date | null;
    vertreterId: string | null;
    vertreter: { id: string; name: string } | null;
  },
  daysUntil: number
): Promise<void> {
  const deadline = eintrag.fristablauf ?? eintrag.datum;
  const deadlineStr = deadline.toLocaleDateString("de-DE");
  const daysText = daysUntil === 1 ? "1 Tag" : `${daysUntil} Tage`;

  if (isUserOnVacation(verantwortlicher) && verantwortlicher.vertreter) {
    // Send to Vertreter with prefix
    await createNotification({
      userId: verantwortlicher.vertreter.id,
      type: "frist:vorfrist",
      title: `[Vertretung fuer ${verantwortlicher.name}] Vorfrist: ${eintrag.titel}`,
      message: `Fristablauf am ${deadlineStr} (noch ${daysText}). Vertretung fuer ${verantwortlicher.name}.`,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        vertretungFuer: verantwortlicher.id,
        daysUntil,
      },
    });

    // Also notify the original Verantwortlicher (delegated note)
    await createNotification({
      userId: verantwortlicher.id,
      type: "frist:vorfrist",
      title: `Vorfrist: ${eintrag.titel} (delegiert an Vertreter)`,
      message: `Fristablauf am ${deadlineStr} (noch ${daysText}). Delegiert an ${verantwortlicher.vertreter.name}.`,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        delegiertAn: verantwortlicher.vertreter.id,
        daysUntil,
      },
    });

    log.info(
      {
        eintragId: eintrag.id,
        vertreterId: verantwortlicher.vertreter.id,
        originalUserId: verantwortlicher.id,
      },
      "Vorfrist notification routed to Vertreter"
    );
  } else {
    // Normal notification to Verantwortlicher
    await createNotification({
      userId: verantwortlicher.id,
      type: "frist:vorfrist",
      title: `Vorfrist: ${eintrag.titel}`,
      message: `Fristablauf am ${deadlineStr} (noch ${daysText}).`,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        daysUntil,
      },
    });
  }
}

/**
 * Send overdue Frist escalation, including Vertreter in escalation chain.
 * Escalation chain: Verantwortlicher -> Vertreter -> Admin
 */
async function sendOverdueEscalation(
  eintrag: {
    id: string;
    titel: string;
    datum: Date;
    fristablauf: Date | null;
    akteId: string | null;
  },
  verantwortlicher: {
    id: string;
    name: string;
    vertretungAktiv: boolean;
    vertretungVon: Date | null;
    vertretungBis: Date | null;
    vertreterId: string | null;
    vertreter: { id: string; name: string } | null;
  }
): Promise<void> {
  const deadline = eintrag.fristablauf ?? eintrag.datum;
  const deadlineStr = deadline.toLocaleDateString("de-DE");
  const notifiedUserIds = new Set<string>();

  // 1. Notify Verantwortlicher
  await createNotification({
    userId: verantwortlicher.id,
    type: "frist:ueberfaellig",
    title: `UEBERFAELLIG: ${eintrag.titel}`,
    message: `Frist war am ${deadlineStr} faellig und ist nicht erledigt!`,
    data: {
      kalenderEintragId: eintrag.id,
      akteId: eintrag.akteId,
    },
  });
  notifiedUserIds.add(verantwortlicher.id);

  // 2. Notify Vertreter if vacation active
  if (
    isUserOnVacation(verantwortlicher) &&
    verantwortlicher.vertreter &&
    !notifiedUserIds.has(verantwortlicher.vertreter.id)
  ) {
    await createNotification({
      userId: verantwortlicher.vertreter.id,
      type: "frist:ueberfaellig",
      title: `[Vertretung fuer ${verantwortlicher.name}] UEBERFAELLIG: ${eintrag.titel}`,
      message: `Frist war am ${deadlineStr} faellig. ${verantwortlicher.name} ist abwesend.`,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        vertretungFuer: verantwortlicher.id,
      },
    });
    notifiedUserIds.add(verantwortlicher.vertreter.id);
  }

  // 3. Escalate to all ADMINs
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", aktiv: true },
    select: { id: true },
  });

  for (const admin of admins) {
    if (!notifiedUserIds.has(admin.id)) {
      await createNotification({
        userId: admin.id,
        type: "frist:ueberfaellig",
        title: `ESKALATION: ${eintrag.titel}`,
        message: `Ueberfaellige Frist (${deadlineStr}), Verantwortlich: ${verantwortlicher.name}.`,
        data: {
          kalenderEintragId: eintrag.id,
          akteId: eintrag.akteId,
          verantwortlicherId: verantwortlicher.id,
        },
      });
    }
  }
}

/**
 * Main processor function for the frist-reminder worker.
 * Should be called periodically (e.g., every 15 minutes via cron/BullMQ).
 */
export async function processFristReminders(): Promise<{
  deactivated: number;
  vorfristenSent: number;
  overdueSent: number;
}> {
  log.info("Starting Frist reminder processing run");

  // Step 1: Auto-deactivate expired Vertretungen
  const deactivated = await deactivateExpiredVertretungen();

  const now = new Date();
  let vorfristenSent = 0;
  let overdueSent = 0;

  // Step 2: Find all active (non-erledigt) FRIST entries with upcoming/past deadlines
  const fristen = await prisma.kalenderEintrag.findMany({
    where: {
      typ: "FRIST",
      erledigt: false,
    },
    include: {
      verantwortlich: {
        select: {
          id: true,
          name: true,
          vertretungAktiv: true,
          vertretungVon: true,
          vertretungBis: true,
          vertreterId: true,
          vertreter: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  for (const frist of fristen) {
    const deadline = frist.fristablauf ?? frist.datum;
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Check Vorfristen array
    if (frist.vorfristen && frist.vorfristen.length > 0) {
      for (const vorfristDate of frist.vorfristen) {
        const vfDate = new Date(vorfristDate);
        // Trigger if Vorfrist is today (within same calendar day)
        const vfDay = vfDate.toISOString().split("T")[0];
        const todayStr = now.toISOString().split("T")[0];
        if (vfDay === todayStr) {
          await sendVorfristNotification(
            frist,
            frist.verantwortlich,
            Math.max(0, diffDays)
          );
          vorfristenSent++;
        }
      }
    }

    // Legacy single Vorfrist field
    if (frist.vorfrist) {
      const vfDay = frist.vorfrist.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      if (vfDay === todayStr) {
        await sendVorfristNotification(
          frist,
          frist.verantwortlich,
          Math.max(0, diffDays)
        );
        vorfristenSent++;
      }
    }

    // Halbfrist reminder
    if (frist.halbfrist) {
      const hfDay = frist.halbfrist.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      if (hfDay === todayStr) {
        await sendVorfristNotification(
          frist,
          frist.verantwortlich,
          Math.max(0, diffDays)
        );
        vorfristenSent++;
      }
    }

    // Check for overdue
    if (diffDays < 0) {
      await sendOverdueEscalation(frist, frist.verantwortlich);
      overdueSent++;
    }
  }

  log.info(
    { deactivated, vorfristenSent, overdueSent },
    "Frist reminder processing complete"
  );

  return { deactivated, vorfristenSent, overdueSent };
}
