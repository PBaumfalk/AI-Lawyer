import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { searchDokumente, type DokumentSearchOptions } from "@/lib/meilisearch";

const EMPTY = { hits: [] as Record<string, unknown>[], estimatedTotalHits: 0, processingTimeMs: 0 };

/**
 * Full-text document search restricted to the Akten the user may open.
 * Every route that searches documents must go through here; calling
 * searchDokumente() directly from a route bypasses access control.
 */
export async function searchDokumenteForUser(
  user: { id: string; role: UserRole },
  query: string,
  options: Omit<DokumentSearchOptions, "akteIds"> = {}
) {
  if (user.role === "MANDANT") return { ...EMPTY, query };
  if (user.role === "ADMIN") return searchDokumente(query, options);

  const erlaubt = await prisma.akte.findMany({
    where: buildAkteAccessFilter(user.id, user.role),
    select: { id: true },
  });
  const akteIds = erlaubt.map((a) => a.id);
  if (akteIds.length === 0 || (options.akteId && !akteIds.includes(options.akteId))) {
    return { ...EMPTY, query };
  }
  return searchDokumente(query, { ...options, akteIds });
}

/** Parse an integer query parameter with bounds and a fallback for garbage. */
export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}
