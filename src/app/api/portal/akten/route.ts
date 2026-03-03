import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getMandantAkten } from "@/lib/portal-access";

// GET /api/portal/akten -- list all Akten for the authenticated Mandant
export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { session } = result;

  // Only MANDANT users may access portal endpoints
  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  try {
    const akten = await getMandantAkten(session.user.id);
    return NextResponse.json({ akten });
  } catch (error) {
    console.error("[PORTAL] Error fetching Mandant Akten:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Akten" },
      { status: 500 }
    );
  }
}
