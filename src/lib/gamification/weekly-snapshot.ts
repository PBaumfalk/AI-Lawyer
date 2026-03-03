/**
 * Weekly Snapshot Creator
 *
 * Creates baseline count snapshots at week start for delta quest evaluation.
 * Called by Monday 00:00 cron job. Each snapshot records the count of open/pending
 * items per model per user at the start of the week.
 *
 * These snapshots serve as baselines for delta conditions
 * (e.g., "reduce open tickets by 20%").
 */

import { startOfWeek } from "date-fns";

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("weekly-snapshot");

export async function createWeeklySnapshots(): Promise<void> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Snapshot open Tickets per user (for "reduce open tickets" weekly quests)
  const ticketCounts = await prisma.ticket.groupBy({
    by: ["verantwortlichId"],
    where: { status: "OFFEN" },
    _count: { id: true },
  });

  for (const entry of ticketCounts) {
    if (!entry.verantwortlichId) continue;
    await prisma.weeklySnapshot.upsert({
      where: {
        model_weekStart_userId: {
          model: "Ticket",
          weekStart,
          userId: entry.verantwortlichId,
        },
      },
      create: {
        model: "Ticket",
        weekStart,
        userId: entry.verantwortlichId,
        count: entry._count.id,
      },
      update: { count: entry._count.id },
    });
  }

  // Snapshot open Fristen per user (for "reduce overdue Fristen" weekly quests)
  const fristCounts = await prisma.kalenderEintrag.groupBy({
    by: ["verantwortlichId"],
    where: { erledigt: false, typ: "FRIST" },
    _count: { id: true },
  });

  for (const entry of fristCounts) {
    if (!entry.verantwortlichId) continue;
    await prisma.weeklySnapshot.upsert({
      where: {
        model_weekStart_userId: {
          model: "KalenderEintrag",
          weekStart,
          userId: entry.verantwortlichId,
        },
      },
      create: {
        model: "KalenderEintrag",
        weekStart,
        userId: entry.verantwortlichId,
        count: entry._count.id,
      },
      update: { count: entry._count.id },
    });
  }

  // Snapshot open Wiedervorlagen per kanzlei (for team dashboard backlog delta)
  const kanzleien = await prisma.kanzlei.findMany({ select: { id: true } });

  for (const k of kanzleien) {
    const wvCount = await prisma.kalenderEintrag.count({
      where: {
        typ: "WIEDERVORLAGE",
        erledigt: false,
        akte: { kanzleiId: k.id },
      },
    });

    // Use findFirst + create/update pattern because Prisma compound unique
    // with nullable userId has edge cases (PostgreSQL NULL != NULL).
    const existing = await prisma.weeklySnapshot.findFirst({
      where: { model: "Wiedervorlage", weekStart, userId: null },
    });

    if (existing) {
      await prisma.weeklySnapshot.update({
        where: { id: existing.id },
        data: { count: wvCount },
      });
    } else {
      await prisma.weeklySnapshot.create({
        data: { model: "Wiedervorlage", weekStart, userId: null, count: wvCount },
      });
    }
  }

  log.info(
    {
      ticketSnapshots: ticketCounts.length,
      fristSnapshots: fristCounts.length,
      wiedervorlageSnapshots: kanzleien.length,
      weekStart: weekStart.toISOString(),
    },
    "Weekly snapshots created",
  );
}
