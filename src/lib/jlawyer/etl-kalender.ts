import { prisma } from "@/lib/db";
import type { JLawyerClient } from "./client";
import type { JLawyerMigrationStats, JLawyerCalendarEntry } from "./types";
import type { KalenderTyp } from "@prisma/client";

function mapKalenderTyp(type: JLawyerCalendarEntry["type"]): KalenderTyp {
  switch (type) {
    case "APPOINTMENT": return "TERMIN";
    case "DEADLINE":    return "FRIST";
    case "FOLLOW_UP":   return "WIEDERVORLAGE";
    default:            return "TERMIN";
  }
}

export async function migrateKalender(
  client: JLawyerClient,
  aktenMap: Map<string, string>,   // jlCaseId → Akte.id
  systemUserId: string,
): Promise<Partial<JLawyerMigrationStats>> {
  const stats = { kalender: 0, errors: [] as JLawyerMigrationStats["errors"] };

  for (const [jlCaseId, akteId] of Array.from(aktenMap.entries())) {
    let entries;
    try {
      entries = await client.getCaseCalendar(jlCaseId);
    } catch (e) {
      stats.errors.push({ entity: "kalender-list", id: jlCaseId, message: (e as Error).message });
      continue;
    }

    for (const entry of entries) {
      try {
        const datum = new Date(entry.startDate);
        const datumBis = entry.endDate ? new Date(entry.endDate) : null;
        const typ = mapKalenderTyp(entry.type);

        // Idempotency: findFirst by jlawyerId, then update or create
        // Note: jlawyerId is @@index (not @unique), so findFirst is used instead of upsert
        const existing = await prisma.kalenderEintrag.findFirst({
          where: { jlawyerId: entry.id },
          select: { id: true },
        });

        if (existing) {
          // Update mutable fields only (title, description, dates may have changed in re-run)
          await prisma.kalenderEintrag.update({
            where: { id: existing.id },
            data: {
              titel: entry.title,
              beschreibung: entry.description ?? null,
              datum,
              datumBis,
              ganztaegig: entry.allDay ?? false,
              erledigt: entry.done ?? false,
            },
          });
        } else {
          await prisma.kalenderEintrag.create({
            data: {
              akteId,
              typ,
              titel: entry.title,
              beschreibung: entry.description ?? null,
              datum,
              datumBis,
              ganztaegig: entry.allDay ?? false,
              erledigt: entry.done ?? false,
              verantwortlichId: systemUserId,
              jlawyerId: entry.id,
            },
          });
        }

        stats.kalender++;
      } catch (e) {
        stats.errors.push({
          entity: "kalender",
          id: entry.id,
          message: (e as Error).message,
        });
      }
    }
  }

  return stats;
}
