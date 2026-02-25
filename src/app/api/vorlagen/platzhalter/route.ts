import { NextResponse } from "next/server";
import { PLATZHALTER_GRUPPEN } from "@/lib/vorlagen";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/vorlagen/platzhalter -- list all available placeholder groups
 */
export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;

  return NextResponse.json({ gruppen: PLATZHALTER_GRUPPEN });
}
