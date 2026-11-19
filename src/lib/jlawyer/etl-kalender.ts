import { prisma } from "@/lib/db";
import { parseJLawyerDate, type JLawyerClient } from "./client";
import type { Benutzerabgleich } from "./benutzer";
import type { JLawyerMigrationStats, JLawyerDueDate } from "./types";
import type { KalenderTyp } from "@prisma/client";

/**
 * Maps the j-lawyer due-date type to KalenderTyp. The catalogue only types
 * the field as string; both the German labels shown in j-lawyer
 * (Wiedervorlage/Frist/Termin) and the internal English names
 * (FOLLOWUP/RESPITE/EVENT) are accepted. Unknown values → null.
 */
export function mapKalenderTyp(type: string | null | undefined): KalenderTyp | null {
  const t = (type ?? "").trim().toLowerCase();
  if (t.startsWith("wiedervorlage") || t === "followup" || t === "follow_up" || t === "10")
    return "WIEDERVORLAGE";
  if (t.startsWith("frist") || t === "respite" || t === "deadline" || t === "20") return "FRIST";
  if (t.startsWith("termin") || t === "event" || t === "appointment" || t === "30") return "TERMIN";
  return null;
}

type Stats = Pick<JLawyerMigrationStats, "kalender" | "errors" | "hinweise">;

/**
 * Migrates j-lawyer due dates (/v4/cases/{id}/duedates) to KalenderEintraege.
 *
 * Responsible user: j-lawyer assignee via Benutzerabgleich → otherwise the
 * Anwalt of the Akte → otherwise the Standard-Verantwortlicher. Every
 * fallback is reported in `hinweise`, so no reminder silently goes to a
 * system account nobody reads.
 *
 * Re-run rule (create-only): entries already carrying the jlawyerId are
 * never modified (erledigt, dates or titles changed in AI-Lawyer stay).
 */
export async function migrateKalender(
  client: JLawyerClient,
  aktenMap: Map<string, string>, // jlCaseId → Akte.id
  anwaltMap: Map<string, string | null>, // Akte.id → anwaltId
  benutzer: Benutzerabgleich,
): Promise<Stats> {
  const stats: Stats = { kalender: 0, errors: [], hinweise: [] };

  for (const [jlCaseId, akteId] of Array.from(aktenMap.entries())) {
    let entries: JLawyerDueDate[];
    try {
      entries = await client.getCaseDueDates(jlCaseId);
    } catch (e) {
      stats.errors.push({ entity: "Kalender-Liste", id: jlCaseId, message: (e as Error).message });
      continue;
    }

    for (const entry of entries) {
      try {
        const existing = await prisma.kalenderEintrag.findFirst({
          where: { jlawyerId: entry.id },
          select: { id: true },
        });
        if (existing) continue;

        const datum = parseJLawyerDate(entry.beginDate) ?? parseJLawyerDate(entry.endDate);
        if (!datum) {
          stats.errors.push({
            entity: "Kalender",
            id: entry.id,
            message: `Kein lesbares Datum (beginDate=${String(entry.beginDate)})`,
          });
          continue;
        }
        const datumBis = entry.beginDate ? parseJLawyerDate(entry.endDate) : null;

        let typ = mapKalenderTyp(entry.type);
        if (!typ) {
          typ = "WIEDERVORLAGE";
          stats.hinweise.push({
            entity: "Kalender",
            id: entry.id,
            message: `Unbekannter j-lawyer-Typ "${entry.type ?? ""}"; als Wiedervorlage übernommen – bitte prüfen.`,
          });
        }

        let verantwortlichId = benutzer.resolve(entry.assignee);
        if (!verantwortlichId) {
          const anwaltId = anwaltMap.get(akteId) ?? null;
          verantwortlichId = anwaltId ?? benutzer.standardId;
          const ziel = anwaltId ? "Anwalt der Akte" : `Standard-Verantwortlicher ${benutzer.standardName}`;
          stats.hinweise.push({
            entity: "Kalender",
            id: entry.id,
            message: entry.assignee
              ? `Verantwortlicher "${entry.assignee}" aus j-lawyer keinem Benutzer zuordenbar; ${ziel} eingesetzt.`
              : `Kein Verantwortlicher in j-lawyer; ${ziel} eingesetzt.`,
          });
        }

        const titel = entry.summary?.trim() || (typ === "FRIST" ? "Frist" : typ === "TERMIN" ? "Termin" : "Wiedervorlage");
        const beschreibung =
          [entry.description?.trim(), entry.location?.trim() ? `Ort: ${entry.location.trim()}` : null]
            .filter(Boolean)
            .join("\n") || null;
        const erledigt = entry.done === true;

        await prisma.kalenderEintrag.create({
          data: {
            akteId,
            typ,
            titel,
            beschreibung,
            datum,
            datumBis,
            ganztaegig: typ !== "TERMIN",
            erledigt,
            erledigtAm: erledigt ? new Date() : null,
            erledigungsgrund: erledigt && typ === "FRIST" ? "In j-lawyer erledigt (Migration)" : null,
            verantwortlichId,
            jlawyerId: entry.id,
          },
        });

        stats.kalender++;
      } catch (e) {
        stats.errors.push({
          entity: "Kalender",
          id: entry.id,
          message: (e as Error).message,
        });
      }
    }
  }

  return stats;
}
