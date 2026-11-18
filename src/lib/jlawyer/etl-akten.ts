import { Sachgebiet, AkteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseJLawyerDate, type JLawyerClient } from "./client";
import type { Benutzerabgleich } from "./benutzer";
import type { JLawyerMigrationStats, JLawyerCase } from "./types";

/**
 * Maps the j-lawyer subject field (Sachgebiet, freely configurable label) to
 * the Prisma Sachgebiet enum.
 */
export function mapSachgebiet(subject: string): Sachgebiet {
  const lower = subject.toLowerCase();
  if (lower.includes("arbeit")) return Sachgebiet.ARBEITSRECHT;
  if (lower.includes("famili")) return Sachgebiet.FAMILIENRECHT;
  if (lower.includes("verkehr")) return Sachgebiet.VERKEHRSRECHT;
  if (lower.includes("miet")) return Sachgebiet.MIETRECHT;
  if (lower.includes("straf")) return Sachgebiet.STRAFRECHT;
  if (lower.includes("erb")) return Sachgebiet.ERBRECHT;
  if (lower.includes("sozial")) return Sachgebiet.SOZIALRECHT;
  if (lower.includes("inkasso")) return Sachgebiet.INKASSO;
  if (lower.includes("handel")) return Sachgebiet.HANDELSRECHT;
  if (lower.includes("verwaltung")) return Sachgebiet.VERWALTUNGSRECHT;
  return Sachgebiet.SONSTIGES;
}

type Stats = Pick<JLawyerMigrationStats, "akten" | "errors" | "hinweise">;

/**
 * Migrates all j-lawyer cases to AI-Lawyer Akten.
 *
 * Re-run rule (create-only): an Akte that already carries the jlawyerId is
 * never modified. After the first import AI-Lawyer is the leading system, so
 * a second run must not reset fields edited there; only missing cases are
 * created.
 *
 * Anwalt/Sachbearbeiter come from the j-lawyer case (lawyer/assistant) via
 * the Benutzerabgleich. An Akte without a matched Anwalt gets the
 * Standard-Verantwortlicher as Anwalt (otherwise only admins could see it);
 * every fallback is reported in `hinweise`.
 *
 * @returns aktenMap (jlCaseId → Akte.id) and anwaltMap (Akte.id → anwaltId)
 */
export async function migrateAkten(
  client: JLawyerClient,
  kanzleiId: string | null,
  benutzer: Benutzerabgleich,
): Promise<Stats & { aktenMap: Map<string, string>; anwaltMap: Map<string, string | null> }> {
  const stats: Stats = { akten: 0, errors: [], hinweise: [] };
  const aktenMap = new Map<string, string>();
  const anwaltMap = new Map<string, string | null>();

  const cases = await client.listCases();

  for (const overview of cases) {
    try {
      const existing = await prisma.akte.findUnique({
        where: { jlawyerId: overview.id },
        select: { id: true, anwaltId: true },
      });
      if (existing) {
        aktenMap.set(overview.id, existing.id);
        anwaltMap.set(existing.id, existing.anwaltId);
        continue;
      }

      // The overview list carries no lawyer/assistant/subject — load details.
      const jlCase: JLawyerCase = await client.getCase(overview.id);
      const fileNumber = (jlCase.fileNumber ?? overview.fileNumber ?? "").trim();
      const aktenzeichen = fileNumber || `JL-${overview.id}`;

      let anwaltId = benutzer.resolve(jlCase.lawyer);
      if (!anwaltId) {
        anwaltId = benutzer.standardId;
        stats.hinweise.push({
          entity: "Akte",
          id: aktenzeichen,
          message: jlCase.lawyer
            ? `Anwalt "${jlCase.lawyer}" aus j-lawyer keinem Benutzer zuordenbar; Standard-Verantwortlicher ${benutzer.standardName} eingesetzt.`
            : `Kein Anwalt in j-lawyer eingetragen; Standard-Verantwortlicher ${benutzer.standardName} eingesetzt.`,
        });
      }
      const sachbearbeiterId = benutzer.resolve(jlCase.assistant);
      if (jlCase.assistant && !sachbearbeiterId) {
        stats.hinweise.push({
          entity: "Akte",
          id: aktenzeichen,
          message: `Sachbearbeiter "${jlCase.assistant}" aus j-lawyer keinem Benutzer zuordenbar; Feld bleibt leer.`,
        });
      }

      const archiviert = jlCase.archived === 1;
      const angelegt = parseJLawyerDate(jlCase.dateCreated) ?? new Date();

      const akte = await prisma.akte.create({
        data: {
          aktenzeichen,
          kurzrubrum: jlCase.name ?? overview.name ?? "",
          wegen: jlCase.reason ?? overview.reason ?? null,
          sachgebiet: mapSachgebiet(jlCase.subjectField ?? ""),
          status: archiviert ? AkteStatus.ARCHIVIERT : AkteStatus.OFFEN,
          archiviert: archiviert ? parseJLawyerDate(jlCase.dateUpdated) ?? new Date() : null,
          gegenstandswert:
            typeof jlCase.claimValue === "number" && jlCase.claimValue > 0 ? jlCase.claimValue : null,
          notizen: jlCase.notice?.trim() ? jlCase.notice : null,
          anwaltId,
          sachbearbeiterId,
          jlawyerId: overview.id,
          angelegt,
          ...(kanzleiId ? { kanzleiId } : {}),
        },
      });

      aktenMap.set(overview.id, akte.id);
      anwaltMap.set(akte.id, anwaltId);
      stats.akten += 1;
    } catch (err) {
      stats.errors.push({
        entity: "Akte",
        id: overview.fileNumber || overview.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ...stats, aktenMap, anwaltMap };
}
