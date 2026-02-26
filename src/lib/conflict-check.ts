import { prisma } from "@/lib/db";

// Roles that represent "our side"
const OWN_SIDE_ROLES = ["MANDANT"];
// Roles that represent "opposing side"
const OPPOSING_SIDE_ROLES = ["GEGNER", "GEGNERVERTRETER"];

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    kontaktId: string;
    kontaktName: string;
    akteId: string;
    aktenzeichen: string;
    kurzrubrum: string;
    existingRolle: string;
    newRolle: string;
  }>;
}

/**
 * Check for conflicts of interest when adding a Beteiligter to an Akte.
 *
 * A conflict exists when:
 * - A Kontakt is MANDANT in one case and GEGNER/GEGNERVERTRETER in another
 * - A Kontakt is GEGNER/GEGNERVERTRETER in one case and MANDANT in another
 */
export async function checkConflicts(
  akteId: string,
  kontaktId: string,
  newRolle: string
): Promise<ConflictResult> {
  const conflicts: ConflictResult["conflicts"] = [];

  // Only check for roles that can create conflicts
  const isNewRoleOwnSide = OWN_SIDE_ROLES.includes(newRolle);
  const isNewRoleOpposingSide = OPPOSING_SIDE_ROLES.includes(newRolle);

  if (!isNewRoleOwnSide && !isNewRoleOpposingSide) {
    return { hasConflict: false, conflicts: [] };
  }

  // Find all existing roles of this Kontakt in OTHER cases
  const existingBeteiligungen = await prisma.beteiligter.findMany({
    where: {
      kontaktId,
      akteId: { not: akteId },
      akte: { status: { in: ["OFFEN", "RUHEND"] } }, // Only active cases
    },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      kontakt: {
        select: {
          typ: true,
          vorname: true,
          nachname: true,
          firma: true,
        },
      },
    },
  });

  for (const beteiligung of existingBeteiligungen) {
    const existingIsOwnSide = OWN_SIDE_ROLES.includes(beteiligung.rolle);
    const existingIsOpposingSide = OPPOSING_SIDE_ROLES.includes(
      beteiligung.rolle
    );

    // Conflict: was on our side, now on opposing side (or vice versa)
    const hasConflict =
      (isNewRoleOwnSide && existingIsOpposingSide) ||
      (isNewRoleOpposingSide && existingIsOwnSide);

    if (hasConflict) {
      const kontaktName =
        beteiligung.kontakt.typ === "NATUERLICH"
          ? `${beteiligung.kontakt.vorname ?? ""} ${beteiligung.kontakt.nachname ?? ""}`.trim()
          : beteiligung.kontakt.firma ?? "";

      conflicts.push({
        kontaktId,
        kontaktName,
        akteId: beteiligung.akte.id,
        aktenzeichen: beteiligung.akte.aktenzeichen,
        kurzrubrum: beteiligung.akte.kurzrubrum,
        existingRolle: beteiligung.rolle,
        newRolle,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}
