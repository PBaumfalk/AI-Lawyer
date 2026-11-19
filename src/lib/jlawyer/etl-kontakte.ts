import { KontaktTyp, BeteiligterRolle, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseJLawyerDate, type JLawyerClient } from "./client";
import type { JLawyerContact, JLawyerMigrationStats } from "./types";

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/**
 * j-lawyer has no explicit contact type: a contact with a company but
 * without first/last name is treated as a legal entity.
 */
export function mapKontaktTyp(c: Pick<JLawyerContact, "company" | "name" | "firstName">): KontaktTyp {
  return blank(c.company) && !blank(c.name) && !blank(c.firstName)
    ? KontaktTyp.JURISTISCH
    : KontaktTyp.NATUERLICH;
}

/**
 * Maps the j-lawyer party type (involvementType, a configurable German
 * label such as "Mandant", "Gegner", "Rechtsanwalt Gegner", "Dritte") to the
 * Prisma BeteiligterRolle enum. Unknown labels become SONSTIGER; the original
 * label is kept in Beteiligter.notizen.
 */
export function mapBeteiligterRolle(type: string | null | undefined): BeteiligterRolle {
  const t = (type ?? "").toLowerCase();
  const isGegner = t.includes("gegner") || t.includes("opponent");
  if (isGegner && (t.includes("anwalt") || t.includes("vertret") || t.includes("attorney")))
    return BeteiligterRolle.GEGNERVERTRETER;
  if (t.includes("mandant") || t.includes("client")) return BeteiligterRolle.MANDANT;
  if (isGegner) return BeteiligterRolle.GEGNER;
  if (t.includes("gericht") || t.includes("court")) return BeteiligterRolle.GERICHT;
  if (t.includes("zeug") || t.includes("witness")) return BeteiligterRolle.ZEUGE;
  if (t.includes("sachverst") || t.includes("gutacht") || t.includes("expert"))
    return BeteiligterRolle.SACHVERSTAENDIGER;
  return BeteiligterRolle.SONSTIGER;
}

export function mapKontaktDaten(c: JLawyerContact): Prisma.KontaktCreateInput {
  const strasse = [blank(c.street), blank(c.streetNumber)].filter(Boolean).join(" ") || null;
  return {
    typ: mapKontaktTyp(c),
    anrede: blank(c.salutation),
    titel: blank(c.title),
    vorname: blank(c.firstName),
    nachname: blank(c.name),
    firma: blank(c.company),
    rechtsform: blank(c.legalForm),
    strasse,
    plz: blank(c.zipCode),
    ort: blank(c.city),
    land: blank(c.country) ?? "Deutschland",
    telefon: blank(c.phone),
    mobil: blank(c.mobile),
    fax: blank(c.fax),
    email: blank(c.email),
    website: blank(c.website),
    geburtsdatum: parseJLawyerDate(blank(c.birthDate)),
    geburtsname: blank(c.birthName),
    geburtsort: blank(c.placeOfBirth),
    beruf: blank(c.profession),
    beaSafeId: blank(c.beaSafeId),
    ustIdNr: blank(c.vatId),
    notizen: blank(c.notice),
    jlawyerId: c.id,
  };
}

type Stats = Pick<JLawyerMigrationStats, "kontakte" | "errors" | "hinweise">;

/**
 * Migrates all j-lawyer contacts to AI-Lawyer Kontakte.
 *
 * Re-run rule (create-only):
 *   - A Kontakt that already carries the jlawyerId is left untouched.
 *   - An existing Kontakt without jlawyerId that has the same e-mail AND the
 *     same last name / company is linked (only jlawyerId is set); its data is
 *     NOT overwritten — it may have been maintained in AI-Lawyer.
 *   - Same e-mail but different name: a new Kontakt is created (shared
 *     family/office addresses are common) and a possible duplicate is
 *     reported in `hinweise`.
 *
 * The contact list (/v1/contacts/list) only contains overview fields; the
 * full record (/v2/contacts/{id}) is loaded for contacts not yet migrated.
 */
export async function migrateKontakte(
  client: JLawyerClient,
): Promise<Stats & { kontakteMap: Map<string, string> }> {
  const stats: Stats = { kontakte: 0, errors: [], hinweise: [] };
  const kontakteMap = new Map<string, string>();

  const contacts = await client.listContacts();

  for (const overview of contacts) {
    try {
      const existing = await prisma.kontakt.findUnique({
        where: { jlawyerId: overview.id },
        select: { id: true },
      });
      if (existing) {
        kontakteMap.set(overview.id, existing.id);
        continue;
      }

      const jlContact = await client.getContact(overview.id);
      const data = mapKontaktDaten({ ...jlContact, id: overview.id });

      if (jlContact.birthDate?.trim() && !data.geburtsdatum) {
        stats.hinweise.push({
          entity: "Kontakt",
          id: overview.id,
          message: `Geburtsdatum "${jlContact.birthDate}" nicht lesbar; nicht übernommen.`,
        });
      }

      const email = data.email;
      if (email) {
        const sameEmail = await prisma.kontakt.findMany({
          where: { email: { equals: email, mode: "insensitive" }, jlawyerId: null },
          select: { id: true, nachname: true, firma: true },
        });
        const key = (data.nachname ?? data.firma ?? "").toLowerCase();
        const match = sameEmail.filter(
          (k) => key && (k.nachname ?? k.firma ?? "").trim().toLowerCase() === key,
        );
        if (match.length === 1) {
          await prisma.kontakt.update({
            where: { id: match[0].id },
            data: { jlawyerId: overview.id },
          });
          kontakteMap.set(overview.id, match[0].id);
          stats.hinweise.push({
            entity: "Kontakt",
            id: overview.id,
            message: `Mit bestehendem Kontakt ${match[0].id} verknüpft (gleiche E-Mail und gleicher Name); vorhandene Daten unverändert.`,
          });
          stats.kontakte += 1;
          continue;
        }
        if (sameEmail.length > 0) {
          stats.hinweise.push({
            entity: "Kontakt",
            id: overview.id,
            message: `Neu angelegt; mögliche Dublette von Kontakt ${sameEmail.map((k) => k.id).join(", ")} (gleiche E-Mail, anderer Name).`,
          });
        }
      }

      const kontakt = await prisma.kontakt.create({ data });
      kontakteMap.set(overview.id, kontakt.id);
      stats.kontakte += 1;
    } catch (err) {
      stats.errors.push({
        entity: "Kontakt",
        id: overview.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ...stats, kontakteMap };
}

/**
 * Migrates j-lawyer case parties (/v1/cases/{id}/parties) to Beteiligte.
 * Existing Beteiligte (akteId, kontaktId, rolle) are left untouched.
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
    let parties;
    try {
      parties = await client.getCaseParties(jlCaseId);
    } catch (err) {
      stats.errors.push({
        entity: "Beteiligte-Liste",
        id: jlCaseId,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    for (const party of parties) {
      try {
        const kontaktId = kontakteMap.get(party.contact);
        if (!kontaktId) {
          stats.errors.push({
            entity: "Beteiligter",
            id: party.id ?? party.contact,
            message: `Kontakt ${party.contact} nicht übernommen (Akte ${jlCaseId})`,
          });
          continue;
        }

        const rolle = mapBeteiligterRolle(party.involvementType);
        const notizen =
          [
            party.involvementType ? `j-lawyer: ${party.involvementType}` : null,
            blank(party.reference) ? `Zeichen: ${party.reference!.trim()}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null;

        const existing = await prisma.beteiligter.findUnique({
          where: { akteId_kontaktId_rolle: { akteId, kontaktId, rolle } },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.beteiligter.create({
          data: { akteId, kontaktId, rolle, notizen },
        });
        stats.beteiligte += 1;
      } catch (err) {
        stats.errors.push({
          entity: "Beteiligter",
          id: party.id ?? party.contact,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return stats;
}
