import { KontaktTyp, BeteiligterRolle } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { JLawyerClient } from "./client";
import type { JLawyerMigrationStats } from "./types";

/**
 * Maps J-Lawyer contact type to Prisma KontaktTyp enum.
 */
function mapKontaktTyp(type: "PERSON" | "ORGANIZATION"): KontaktTyp {
  return type === "ORGANIZATION" ? KontaktTyp.JURISTISCH : KontaktTyp.NATUERLICH;
}

/**
 * Maps J-Lawyer participant role string to Prisma BeteiligterRolle enum.
 */
function mapBeteiligterRolle(role: string): BeteiligterRolle {
  const upper = role.toUpperCase();
  if (upper === "CLIENT" || upper === "MANDANT") return BeteiligterRolle.MANDANT;
  if (upper === "OPPONENT" || upper === "GEGNER") return BeteiligterRolle.GEGNER;
  if (upper === "OPPONENT_ATTORNEY" || upper === "GEGNERVERTRETER")
    return BeteiligterRolle.GEGNERVERTRETER;
  if (upper === "COURT" || upper === "GERICHT") return BeteiligterRolle.GERICHT;
  if (upper === "WITNESS" || upper === "ZEUGE") return BeteiligterRolle.ZEUGE;
  if (upper === "EXPERT" || upper === "SACHVERSTAENDIGER")
    return BeteiligterRolle.SACHVERSTAENDIGER;
  return BeteiligterRolle.SONSTIGER;
}

/**
 * Migrates all J-Lawyer contacts to AI-Lawyer Kontakte.
 *
 * Deduplication strategy:
 *   1. Primary key: jlawyerId (upsert where jlawyerId)
 *   2. Email fallback: if a Kontakt with the same email already exists
 *      (without a jlawyerId), update it to claim the jlawyerId and continue.
 *
 * @param client  Authenticated JLawyerClient
 * @returns Partial migration stats with kontakte count and per-record errors
 */
export async function migrateKontakte(
  client: JLawyerClient,
): Promise<Pick<JLawyerMigrationStats, "kontakte" | "errors"> & { kontakteMap: Map<string, string> }> {
  const stats: Pick<JLawyerMigrationStats, "kontakte" | "errors"> = {
    kontakte: 0,
    errors: [],
  };
  const kontakteMap = new Map<string, string>();

  const contacts = await client.listContacts();

  for (const jlContact of contacts) {
    try {
      const typ = mapKontaktTyp(jlContact.type);
      const geburtsdatum =
        jlContact.dateOfBirth ? new Date(jlContact.dateOfBirth) : null;
      const land = jlContact.country ?? "Deutschland";

      const data = {
        typ,
        vorname: jlContact.firstName ?? null,
        nachname: jlContact.lastName ?? null,
        firma: jlContact.company ?? null,
        strasse: jlContact.street ?? null,
        plz: jlContact.zipCode ?? null,
        ort: jlContact.city ?? null,
        land,
        telefon: jlContact.phone ?? null,
        mobil: jlContact.mobile ?? null,
        fax: jlContact.fax ?? null,
        email: jlContact.email ?? null,
        geburtsdatum,
        notizen: jlContact.note ?? null,
        jlawyerId: jlContact.id,
      };

      // Email fallback deduplication: if a record without a jlawyerId exists
      // with the same email, claim it by setting its jlawyerId first.
      if (jlContact.email) {
        const existingByEmail = await prisma.kontakt.findFirst({
          where: { email: jlContact.email, jlawyerId: null },
          select: { id: true },
        });
        if (existingByEmail) {
          await prisma.kontakt.update({
            where: { id: existingByEmail.id },
            data,
          });
          kontakteMap.set(jlContact.id, existingByEmail.id);
          stats.kontakte += 1;
          continue;
        }
      }

      // Primary upsert by jlawyerId
      const kontakt = await prisma.kontakt.upsert({
        where: { jlawyerId: jlContact.id },
        create: data,
        update: data,
      });

      kontakteMap.set(jlContact.id, kontakt.id);
      stats.kontakte += 1;
    } catch (err) {
      stats.errors.push({
        entity: "Kontakt",
        id: jlContact.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ...stats, kontakteMap };
}

/**
 * Migrates J-Lawyer case participants to AI-Lawyer Beteiligte.
 *
 * Requires pre-built maps from the migration runner:
 *   - aktenMap: jlCaseId → Akte.id
 *   - kontakteMap: jlContactId → Kontakt.id
 *
 * Upsert key: (akteId, kontaktId, rolle) — Prisma compound unique.
 *
 * @param client       Authenticated JLawyerClient
 * @param aktenMap     Map of J-Lawyer case ID → AI-Lawyer Akte.id
 * @param kontakteMap  Map of J-Lawyer contact ID → AI-Lawyer Kontakt.id
 * @returns Partial migration stats with beteiligte count and per-record errors
 */
export async function migrateBeteiligte(
  client: JLawyerClient,
  aktenMap: Map<string, string>,
  kontakteMap: Map<string, string>,
): Promise<Pick<JLawyerMigrationStats, "beteiligte" | "errors">> {
  const stats: Pick<JLawyerMigrationStats, "beteiligte" | "errors"> = {
    beteiligte: 0,
    errors: [],
  };

  for (const [jlCaseId, akteId] of Array.from(aktenMap.entries())) {
    let participants;
    try {
      participants = await client.getCaseParticipants(jlCaseId);
    } catch (err) {
      stats.errors.push({
        entity: "Beteiligte-list",
        id: jlCaseId,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    for (const participant of participants) {
      try {
        const kontaktId = kontakteMap.get(participant.contactId);
        if (!kontaktId) {
          stats.errors.push({
            entity: "Beteiligter",
            id: participant.contactId,
            message: `Kontakt not found in kontakteMap for caseId=${jlCaseId}`,
          });
          continue;
        }

        const rolle = mapBeteiligterRolle(participant.role);

        await prisma.beteiligter.upsert({
          where: {
            akteId_kontaktId_rolle: { akteId, kontaktId, rolle },
          },
          create: {
            akteId,
            kontaktId,
            rolle,
            notizen: participant.note ?? null,
          },
          update: {
            notizen: participant.note ?? null,
          },
        });

        stats.beteiligte += 1;
      } catch (err) {
        stats.errors.push({
          entity: "Beteiligter",
          id: participant.contactId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return stats;
}
