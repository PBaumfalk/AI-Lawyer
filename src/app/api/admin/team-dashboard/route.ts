/**
 * Team Dashboard API Route
 *
 * Returns aggregated team metrics for the admin Team Dashboard.
 * ADMIN-only access. No per-user data in response (DSGVO-compliant).
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getTeamMetrics } from "@/lib/gamification/team-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return NextResponse.json(
      { error: "Keine Kanzlei zugeordnet" },
      { status: 400 },
    );
  }

  const metrics = await getTeamMetrics(kanzleiId);

  return NextResponse.json(metrics);
}
