import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import { BiFilterError, buildBiScope, parseBiFilters, type BiScope } from "@/lib/bi/kpi-queries";

type ParsedFilters = ReturnType<typeof parseBiFilters>;

/**
 * Common entry for all /api/bi/* routes: staff only (clients have no firm
 * statistics), validated filters (400 instead of a Prisma error → 500) and the
 * access scope every query must use.
 */
export async function resolveBiRequest(
  request: NextRequest
): Promise<
  | { error: NextResponse; filters?: undefined; scope?: undefined; userId?: undefined }
  | { error?: undefined; filters: ParsedFilters; scope: BiScope; userId: string }
> {
  const result = await requireRole("ADMIN", "ANWALT", "SACHBEARBEITER", "SEKRETARIAT");
  if (result.error) return { error: result.error };
  const { user } = result.session;

  let filters: ParsedFilters;
  try {
    filters = parseBiFilters(new URL(request.url).searchParams);
  } catch (err) {
    if (err instanceof BiFilterError) {
      return { error: NextResponse.json({ error: err.message }, { status: 400 }) };
    }
    throw err;
  }
  return { filters, scope: buildBiScope(user, filters.params), userId: user.id };
}
