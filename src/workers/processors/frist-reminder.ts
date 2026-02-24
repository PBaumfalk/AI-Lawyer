/**
 * Frist Reminder Worker Processor
 *
 * Checks for upcoming deadlines and sends reminder notifications.
 * Considers Vertretung: when Verantwortlicher is on vacation,
 * notifications route to their Vertreter.
 *
 * Features:
 * - Deduplication: never send the same reminder twice on the same day
 * - Dual-channel: in-app notification + email
 * - Weekend/holiday shift: reminders for weekend/Feiertag fire on preceding Friday
 * - Catch-up: sends missed reminders after downtime
 * - Akte reference in notification content
 *
 * Auto-deactivates expired Vertretung periods.
 */

import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { createLogger } from "@/lib/logger";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getSettingTyped } from "@/lib/settings/service";
import { istFeiertag } from "@/lib/fristen/feiertage";
import type { BundeslandCode } from "@/lib/fristen/types";
import {
  startOfDay,
  endOfDay,
  isSaturday,
  isSunday,
  isFriday,
  subDays,
  differenceInCalendarDays,
  isToday,
  isBefore,
} from "date-fns";

const log = createLogger("frist-reminder");

// ─── Types ──────────────────────────────────────────────────────────────────

interface VerantwortlicherData {
  id: string;
  name: string;
  email: string;
  vertretungAktiv: boolean;
  vertretungVon: Date | null;
  vertretungBis: Date | null;
  vertreterId: string | null;
  vertreter: { id: string; name: string; email: string } | null;
}

interface FristEintragData {
  id: string;
  titel: string;
  datum: Date;
  fristablauf: Date | null;
  akteId: string | null;
  bundesland: string | null;
  akte: { aktenzeichen: string; kurzrubrum: string } | null;
  vorfristen: Date[];
  vorfrist: Date | null;
  halbfrist: Date | null;
  erledigt: boolean;
  verantwortlich: VerantwortlicherData;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
 * Check if a reminder has already been sent today for a given KalenderEintrag + type + daysUntil.
 * Deduplication via Notification table -- prevents sending the same reminder twice on the same day.
 */
async function isReminderAlreadySent(
  kalenderEintragId: string,
  type: string,
  daysUntil?: number
): Promise<boolean> {
  const today = new Date();

  const existing = await prisma.notification.findFirst({
    where: {
      type,
      data: {
        path: ["kalenderEintragId"],
        equals: kalenderEintragId,
      },
      createdAt: {
        gte: startOfDay(today),
        lt: endOfDay(today),
      },
      ...(daysUntil !== undefined
        ? {
            AND: {
              data: {
                path: ["daysUntil"],
                equals: daysUntil,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Determine if a reminder with the given target date should fire today.
 * Handles weekend and holiday shift: if the target date falls on
 * Saturday, Sunday, or a Feiertag, fire on the preceding business day.
 */
function shouldFireToday(
  reminderDate: Date,
  bundesland: BundeslandCode = "NW"
): boolean {
  const today = new Date();

  // Direct match: reminder date IS today
  if (isToday(reminderDate)) return true;

  // Weekend shift: if today is Friday and reminder is Saturday or Sunday
  if (isFriday(today)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const remStr = reminderDate.toISOString().split("T")[0];
    const tomStr = tomorrow.toISOString().split("T")[0];
    const dayAfterStr = dayAfter.toISOString().split("T")[0];

    if (
      (remStr === tomStr && isSaturday(tomorrow)) ||
      (remStr === dayAfterStr && isSunday(dayAfter))
    ) {
      return true;
    }
  }

  // Holiday shift: if reminderDate is a Feiertag, find the preceding business day
  if (istFeiertag(reminderDate, bundesland)) {
    let shiftedDate = new Date(reminderDate);
    // Walk backwards to find the preceding business day
    for (let i = 0; i < 5; i++) {
      shiftedDate = subDays(shiftedDate, 1);
      if (
        !isSaturday(shiftedDate) &&
        !isSunday(shiftedDate) &&
        !istFeiertag(shiftedDate, bundesland)
      ) {
        break;
      }
    }
    if (isToday(shiftedDate)) return true;
  }

  return false;
}

/**
 * Check if a reminder date is in the past (for catch-up logic).
 */
function isInPast(reminderDate: Date): boolean {
  const todayStart = startOfDay(new Date());
  return isBefore(reminderDate, todayStart);
}

/**
 * Build notification title with Akte reference.
 */
function buildTitle(
  prefix: string,
  titel: string,
  akte: { aktenzeichen: string; kurzrubrum: string } | null
): string {
  const akteRef = akte ? ` -- Akte ${akte.aktenzeichen} ${akte.kurzrubrum}` : "";
  return `${prefix}${titel}${akteRef}`;
}

/**
 * Attempt to send email to a user for a frist notification.
 * Returns silently on failure -- email is best-effort.
 */
async function trySendEmail(
  userEmail: string,
  subject: string,
  message: string,
  akteId: string | null
): Promise<void> {
  if (!userEmail) return;
  if (!isEmailConfigured()) return;

  const emailEnabled = await getSettingTyped<boolean>(
    "fristen.email_enabled",
    true
  );
  if (!emailEnabled) return;

  const linkHint = akteId
    ? `\n\nAkte oeffnen: /akten/${akteId}`
    : "";

  const html = `<p>${message.replace(/\n/g, "<br>")}</p>${
    akteId
      ? `<p><a href="/akten/${akteId}">Akte oeffnen</a></p>`
      : ""
  }`;

  await sendEmail({
    to: userEmail,
    subject,
    text: message + linkHint,
    html,
  });
}

// ─── Notification Senders ───────────────────────────────────────────────────

/**
 * Send Vorfrist notification, routing to Vertreter if user is on vacation.
 * Dual-channel: in-app first, then email.
 */
async function sendVorfristNotification(
  eintrag: FristEintragData,
  verantwortlicher: VerantwortlicherData,
  daysUntil: number,
  isCatchUp = false
): Promise<void> {
  // Deduplication check
  if (
    await isReminderAlreadySent(eintrag.id, "frist:vorfrist", daysUntil)
  ) {
    log.debug(
      { eintragId: eintrag.id, daysUntil },
      "Vorfrist reminder already sent today, skipping"
    );
    return;
  }

  const deadline = eintrag.fristablauf ?? eintrag.datum;
  const deadlineStr = deadline.toLocaleDateString("de-DE");
  const daysText = daysUntil === 1 ? "1 Tag" : `${daysUntil} Tage`;
  const catchUpNote = isCatchUp ? " [Nachversand]" : "";

  const titleBase = buildTitle(
    `Frist in ${daysText}: `,
    eintrag.titel,
    eintrag.akte
  );

  if (isUserOnVacation(verantwortlicher) && verantwortlicher.vertreter) {
    // Send to Vertreter with prefix
    const vertreterTitle = `[Vertretung fuer ${verantwortlicher.name}] ${titleBase}${catchUpNote}`;
    const vertreterMsg = `Fristablauf am ${deadlineStr} (noch ${daysText}). Vertretung fuer ${verantwortlicher.name}.`;

    await createNotification({
      userId: verantwortlicher.vertreter.id,
      type: "frist:vorfrist",
      title: vertreterTitle,
      message: vertreterMsg,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        vertretungFuer: verantwortlicher.id,
        daysUntil,
      },
    });

    // Email to Vertreter
    await trySendEmail(
      verantwortlicher.vertreter.email,
      vertreterTitle,
      vertreterMsg,
      eintrag.akteId
    );

    // Also notify the original Verantwortlicher (delegated note)
    const delegatedTitle = `${titleBase} (delegiert an Vertreter)${catchUpNote}`;
    const delegatedMsg = `Fristablauf am ${deadlineStr} (noch ${daysText}). Delegiert an ${verantwortlicher.vertreter.name}.`;

    await createNotification({
      userId: verantwortlicher.id,
      type: "frist:vorfrist",
      title: delegatedTitle,
      message: delegatedMsg,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        delegiertAn: verantwortlicher.vertreter.id,
        daysUntil,
      },
    });

    // Email to Verantwortlicher
    await trySendEmail(
      verantwortlicher.email,
      delegatedTitle,
      delegatedMsg,
      eintrag.akteId
    );

    log.info(
      {
        eintragId: eintrag.id,
        vertreterId: verantwortlicher.vertreter.id,
        originalUserId: verantwortlicher.id,
        isCatchUp,
      },
      "Vorfrist notification routed to Vertreter"
    );
  } else {
    // Normal notification to Verantwortlicher
    const normalTitle = `${titleBase}${catchUpNote}`;
    const normalMsg = `Fristablauf am ${deadlineStr} (noch ${daysText}).`;

    await createNotification({
      userId: verantwortlicher.id,
      type: "frist:vorfrist",
      title: normalTitle,
      message: normalMsg,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        daysUntil,
      },
    });

    // Email to Verantwortlicher
    await trySendEmail(
      verantwortlicher.email,
      normalTitle,
      normalMsg,
      eintrag.akteId
    );
  }
}

/**
 * Send overdue Frist escalation, including Vertreter in escalation chain.
 * Escalation chain: Verantwortlicher -> Vertreter -> Admin
 * Dual-channel: in-app first, then email.
 */
async function sendOverdueEscalation(
  eintrag: FristEintragData,
  verantwortlicher: VerantwortlicherData
): Promise<void> {
  // Deduplication for overdue (check by kalenderEintragId + type per day)
  if (await isReminderAlreadySent(eintrag.id, "frist:ueberfaellig")) {
    log.debug(
      { eintragId: eintrag.id },
      "Overdue escalation already sent today, skipping"
    );
    return;
  }

  const deadline = eintrag.fristablauf ?? eintrag.datum;
  const deadlineStr = deadline.toLocaleDateString("de-DE");
  const notifiedUserIds = new Set<string>();

  const akteRef = eintrag.akte
    ? ` -- Akte ${eintrag.akte.aktenzeichen} ${eintrag.akte.kurzrubrum}`
    : "";

  // 1. Notify Verantwortlicher
  const verantwortlicherTitle = `UEBERFAELLIG: ${eintrag.titel}${akteRef}`;
  const verantwortlicherMsg = `Frist war am ${deadlineStr} faellig und ist nicht erledigt!`;

  await createNotification({
    userId: verantwortlicher.id,
    type: "frist:ueberfaellig",
    title: verantwortlicherTitle,
    message: verantwortlicherMsg,
    data: {
      kalenderEintragId: eintrag.id,
      akteId: eintrag.akteId,
    },
  });
  notifiedUserIds.add(verantwortlicher.id);

  await trySendEmail(
    verantwortlicher.email,
    verantwortlicherTitle,
    verantwortlicherMsg,
    eintrag.akteId
  );

  // 2. Notify Vertreter if vacation active
  if (
    isUserOnVacation(verantwortlicher) &&
    verantwortlicher.vertreter &&
    !notifiedUserIds.has(verantwortlicher.vertreter.id)
  ) {
    const vertreterTitle = `[Vertretung fuer ${verantwortlicher.name}] UEBERFAELLIG: ${eintrag.titel}${akteRef}`;
    const vertreterMsg = `Frist war am ${deadlineStr} faellig. ${verantwortlicher.name} ist abwesend.`;

    await createNotification({
      userId: verantwortlicher.vertreter.id,
      type: "frist:ueberfaellig",
      title: vertreterTitle,
      message: vertreterMsg,
      data: {
        kalenderEintragId: eintrag.id,
        akteId: eintrag.akteId,
        vertretungFuer: verantwortlicher.id,
      },
    });
    notifiedUserIds.add(verantwortlicher.vertreter.id);

    await trySendEmail(
      verantwortlicher.vertreter.email,
      vertreterTitle,
      vertreterMsg,
      eintrag.akteId
    );
  }

  // 3. Escalate to all ADMINs
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", aktiv: true },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    if (!notifiedUserIds.has(admin.id)) {
      const adminTitle = `ESKALATION: ${eintrag.titel}${akteRef}`;
      const adminMsg = `Ueberfaellige Frist (${deadlineStr}), Verantwortlich: ${verantwortlicher.name}.`;

      await createNotification({
        userId: admin.id,
        type: "frist:ueberfaellig",
        title: adminTitle,
        message: adminMsg,
        data: {
          kalenderEintragId: eintrag.id,
          akteId: eintrag.akteId,
          verantwortlicherId: verantwortlicher.id,
        },
      });

      await trySendEmail(admin.email, adminTitle, adminMsg, eintrag.akteId);
    }
  }
}

// ─── Main Processor ─────────────────────────────────────────────────────────

/**
 * Main processor function for the frist-reminder worker.
 * Called daily via BullMQ cron (default 06:00 Europe/Berlin).
 */
export async function processFristReminders(): Promise<{
  deactivated: number;
  vorfristenSent: number;
  overdueSent: number;
}> {
  log.info("Starting Frist reminder processing run");

  // Step 1: Auto-deactivate expired Vertretungen
  const deactivated = await deactivateExpiredVertretungen();

  // Read max retry age for catch-up email limiting
  const maxRetryAgeDays = await getSettingTyped<number>(
    "fristen.max_retry_age_days",
    3
  );

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
      akte: {
        select: {
          aktenzeichen: true,
          kurzrubrum: true,
        },
      },
      verantwortlich: {
        select: {
          id: true,
          name: true,
          email: true,
          vertretungAktiv: true,
          vertretungVon: true,
          vertretungBis: true,
          vertreterId: true,
          vertreter: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  for (const frist of fristen) {
    const deadline = frist.fristablauf ?? frist.datum;
    const diffDays = differenceInCalendarDays(deadline, now);
    const bundesland = (frist.bundesland ?? "NW") as BundeslandCode;

    // Cast to our typed interface
    const eintrag = frist as unknown as FristEintragData;

    // ── Check Vorfristen array ──
    if (frist.vorfristen && frist.vorfristen.length > 0) {
      for (const vorfristDate of frist.vorfristen) {
        const vfDate = new Date(vorfristDate);
        const vfDaysUntil = Math.max(0, differenceInCalendarDays(deadline, vfDate));

        if (shouldFireToday(vfDate, bundesland)) {
          await sendVorfristNotification(
            eintrag,
            eintrag.verantwortlich,
            vfDaysUntil
          );
          vorfristenSent++;
        } else if (isInPast(vfDate)) {
          // Catch-up: send missed reminders (limited by max_retry_age_days for email)
          const ageInDays = differenceInCalendarDays(now, vfDate);
          const isCatchUp = true;
          if (ageInDays <= maxRetryAgeDays) {
            await sendVorfristNotification(
              eintrag,
              eintrag.verantwortlich,
              vfDaysUntil,
              isCatchUp
            );
            vorfristenSent++;
          }
        }
      }
    }

    // ── Legacy single Vorfrist field ──
    if (frist.vorfrist) {
      const vfDate = frist.vorfrist;
      const vfDaysUntil = Math.max(0, differenceInCalendarDays(deadline, vfDate));

      if (shouldFireToday(vfDate, bundesland)) {
        await sendVorfristNotification(
          eintrag,
          eintrag.verantwortlich,
          vfDaysUntil
        );
        vorfristenSent++;
      } else if (isInPast(vfDate)) {
        const ageInDays = differenceInCalendarDays(now, vfDate);
        if (ageInDays <= maxRetryAgeDays) {
          await sendVorfristNotification(
            eintrag,
            eintrag.verantwortlich,
            vfDaysUntil,
            true
          );
          vorfristenSent++;
        }
      }
    }

    // ── Halbfrist reminder ──
    if (frist.halbfrist) {
      const hfDate = frist.halbfrist;
      const hfDaysUntil = Math.max(0, differenceInCalendarDays(deadline, hfDate));

      if (shouldFireToday(hfDate, bundesland)) {
        await sendVorfristNotification(
          eintrag,
          eintrag.verantwortlich,
          hfDaysUntil
        );
        vorfristenSent++;
      } else if (isInPast(hfDate)) {
        const ageInDays = differenceInCalendarDays(now, hfDate);
        if (ageInDays <= maxRetryAgeDays) {
          await sendVorfristNotification(
            eintrag,
            eintrag.verantwortlich,
            hfDaysUntil,
            true
          );
          vorfristenSent++;
        }
      }
    }

    // ── Check for overdue (with deduplication) ──
    if (diffDays < 0) {
      await sendOverdueEscalation(eintrag, eintrag.verantwortlich);
      overdueSent++;
    }
  }

  log.info(
    { deactivated, vorfristenSent, overdueSent },
    "Frist reminder processing complete"
  );

  return { deactivated, vorfristenSent, overdueSent };
}
