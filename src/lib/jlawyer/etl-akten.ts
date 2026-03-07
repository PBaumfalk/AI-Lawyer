import { Sachgebiet, AkteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { JLawyerClient } from "./client";
import type { JLawyerMigrationStats } from "./types";

/**
 * Maps J-Lawyer subject string to Prisma Sachgebiet enum.
 */
function mapSachgebiet(subject: string): Sachgebiet {
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

/**
 * Maps J-Lawyer status string to Prisma AkteStatus enum.
 */
function mapAkteStatus(status: string): AkteStatus {
  const upper = status.toUpperCase();
  if (upper === "OPEN" || upper === "ACTIVE") return AkteStatus.OFFEN;
  if (upper === "SUSPENDED" || upper === "SLEEPING") return AkteStatus.RUHEND;
  if (upper === "ARCHIVED") return AkteStatus.ARCHIVIERT;
  if (upper === "CLOSED") return AkteStatus.GESCHLOSSEN;
  return AkteStatus.OFFEN;
}

/**
 * Migrates all J-Lawyer cases to AI-Lawyer Akten.
 *
 * Idempotent: uses jlawyerId as the upsert key — re-running will update
 * existing records rather than duplicating them.
 *
 * @param client   Authenticated JLawyerClient
 * @param kanzleiId  Optional kanzleiId to set on created Akten
 * @returns Partial migration stats with akten count and any per-record errors
 */
export async function migrateAkten(
  client: JLawyerClient,
  kanzleiId: string | null,
): Promise<Pick<JLawyerMigrationStats, "akten" | "errors"> & { aktenMap: Map<string, string> }> {
  const stats: Pick<JLawyerMigrationStats, "akten" | "errors"> = {
    akten: 0,
    errors: [],
  };
  const aktenMap = new Map<string, string>();

  const cases = await client.listCases();

  for (const jlCase of cases) {
    try {
      const aktenzeichen = jlCase.fileNumber?.trim()
        ? jlCase.fileNumber.trim()
        : `JL-${jlCase.id}`;

      const sachgebiet = mapSachgebiet(jlCase.subject ?? "");
      const status = mapAkteStatus(jlCase.status ?? "");
      const angelegt = jlCase.dateCreated ? new Date(jlCase.dateCreated) : new Date();

      const akte = await prisma.akte.upsert({
        where: { jlawyerId: jlCase.id },
        create: {
          aktenzeichen,
          kurzrubrum: jlCase.name ?? "",
          wegen: jlCase.reason ?? null,
          sachgebiet,
          status,
          jlawyerId: jlCase.id,
          angelegt,
          ...(kanzleiId ? { kanzleiId } : {}),
        },
        update: {
          aktenzeichen,
          kurzrubrum: jlCase.name ?? "",
          wegen: jlCase.reason ?? null,
          sachgebiet,
          status,
          ...(kanzleiId ? { kanzleiId } : {}),
        },
      });

      aktenMap.set(jlCase.id, akte.id);
      stats.akten += 1;
    } catch (err) {
      stats.errors.push({
        entity: "Akte",
        id: jlCase.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ...stats, aktenMap };
}
