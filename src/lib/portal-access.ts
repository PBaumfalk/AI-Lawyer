import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─── Portal Access Control ─────────────────────────────────────────────────
// Server-side data isolation for MANDANT users.
// Access chain: User.kontaktId -> Beteiligter(kontaktId, rolle=MANDANT) -> Akte
// All filtering happens at query level -- no client-side filtering.

/**
 * Returns all Akten where the user's linked Kontakt is a Beteiligter with rolle=MANDANT.
 * Used by GET /api/portal/akten to list the Mandant's cases.
 */
export async function getMandantAkten(userId: string) {
  // Resolve the user's kontaktId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kontaktId: true },
  });

  if (!user?.kontaktId) {
    return [];
  }

  // Find all Akten where this Kontakt is a Beteiligter with rolle=MANDANT
  const akten = await prisma.akte.findMany({
    where: {
      beteiligte: {
        some: {
          kontaktId: user.kontaktId,
          rolle: "MANDANT",
        },
      },
    },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      sachgebiet: true,
      status: true,
      naechsteSchritte: true,
    },
    orderBy: { geaendert: "desc" },
  });

  return akten;
}

/**
 * Verifies the given user has MANDANT access to a specific Akte.
 * Access chain: User.kontaktId -> Beteiligter(kontaktId, rolle=MANDANT) -> Akte
 * Returns 404 (not 403) on unauthorized access to hide Akte existence.
 */
export async function requireMandantAkteAccess(
  akteId: string,
  userId: string
): Promise<
  | { akte: { id: string }; error?: undefined }
  | { akte?: undefined; error: NextResponse }
> {
  // Resolve the user's kontaktId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kontaktId: true },
  });

  if (!user?.kontaktId) {
    return {
      error: NextResponse.json(
        { error: "Nicht gefunden" },
        { status: 404 }
      ),
    };
  }

  // Check if a Beteiligter with rolle=MANDANT exists for this Kontakt on this Akte
  const beteiligter = await prisma.beteiligter.findFirst({
    where: {
      akteId,
      kontaktId: user.kontaktId,
      rolle: "MANDANT",
    },
    select: {
      akte: {
        select: { id: true },
      },
    },
  });

  if (!beteiligter) {
    return {
      error: NextResponse.json(
        { error: "Nicht gefunden" },
        { status: 404 }
      ),
    };
  }

  return { akte: beteiligter.akte };
}
