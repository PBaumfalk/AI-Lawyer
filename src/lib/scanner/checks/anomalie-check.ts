import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";
import { createScannerAlert, resolveAlertRecipients } from "../service";

const log = createLogger("scanner:anomalie-check");

/**
 * Anomalie-Check: structural completeness checks.
 * - BETEILIGTE_FEHLEN: Akte has no Mandant or no Gegner
 * - DOKUMENT_FEHLT: expected documents per Sachgebiet not found
 *
 * Uses a single combined query for both checks to avoid redundant DB calls.
 *
 * @returns Number of alerts created (excluding deduplicated ones)
 */
export async function runAnomalieCheck(): Promise<number> {
  // Load required documents config from SystemSetting
  const requiredDocs = await getSettingTyped<Record<string, string[]>>(
    "scanner.required_documents",
    { default: ["Vollmacht"] }
  );

  // Single combined query for both BETEILIGTE_FEHLEN and DOKUMENT_FEHLT
  const akten = await prisma.akte.findMany({
    where: { status: "OFFEN" },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      sachgebiet: true,
      anwaltId: true,
      sachbearbeiterId: true,
      beteiligte: { select: { rolle: true } },
      dokumente: { select: { name: true } },
    },
  });

  log.info({ aktenCount: akten.length }, "Running anomalie check on open Akten");

  let alertsCreated = 0;

  for (const akte of akten) {
    const recipients = await resolveAlertRecipients(akte);
    if (recipients.length === 0) continue;

    // --- BETEILIGTE_FEHLEN check ---
    const roles = new Set(akte.beteiligte.map((b) => b.rolle));
    const missingRoles: string[] = [];

    if (!roles.has("MANDANT")) missingRoles.push("Mandant");
    if (!roles.has("GEGNER")) missingRoles.push("Gegner");

    if (missingRoles.length > 0) {
      const missingText =
        missingRoles.length === 2
          ? "Mandant und Gegner fehlen"
          : `${missingRoles[0]} fehlt`;

      for (const userId of recipients) {
        const alert = await createScannerAlert({
          akteId: akte.id,
          userId,
          typ: "BETEILIGTE_FEHLEN",
          severity: 5,
          titel: `Fehlende Beteiligte: ${akte.aktenzeichen}`,
          inhalt: `${missingText} in der Akte.`,
          meta: { missingRoles },
        });

        if (alert) alertsCreated++;
      }
    }

    // --- DOKUMENT_FEHLT check ---
    const expectedDocs =
      requiredDocs[akte.sachgebiet] ?? requiredDocs["default"] ?? [];

    if (expectedDocs.length === 0) continue;

    const docNames = akte.dokumente.map((d) => d.name.toLowerCase());

    const missingDocs = expectedDocs.filter((expectedName) => {
      const expectedLower = expectedName.toLowerCase();

      // Vollmacht special case: also match "mandatsvollmacht" in name
      if (expectedLower === "vollmacht") {
        return !docNames.some(
          (name) =>
            name.includes("vollmacht") || name.includes("mandatsvollmacht")
        );
      }

      // General case: partial match on document name
      return !docNames.some((name) => name.includes(expectedLower));
    });

    if (missingDocs.length > 0) {
      for (const userId of recipients) {
        const alert = await createScannerAlert({
          akteId: akte.id,
          userId,
          typ: "DOKUMENT_FEHLT",
          severity: 3,
          titel: `Fehlende Dokumente: ${akte.aktenzeichen}`,
          inhalt: `Folgende Dokumente fehlen: ${missingDocs.join(", ")}`,
          meta: { missingDocs, sachgebiet: akte.sachgebiet },
        });

        if (alert) alertsCreated++;
      }
    }
  }

  log.info({ alertsCreated }, "Anomalie check completed");
  return alertsCreated;
}
