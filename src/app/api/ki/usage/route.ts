import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTokenUsageSummary, checkBudget } from "@/lib/ai/token-tracker";
import { isProviderAvailable } from "@/lib/ai/provider";
import type { UserRole } from "@prisma/client";

/**
 * GET /api/ki/usage
 *
 * Token usage summary for admin dashboard.
 * Query params: period (day|week|month, default month)
 * Admin only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const role = (session.user as any).role as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Nur Administratoren koennen Token-Verbrauch einsehen" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") || "month") as
    | "day"
    | "week"
    | "month";

  // Validate period
  if (!["day", "week", "month"].includes(period)) {
    return NextResponse.json(
      { error: "Ungueltiger Zeitraum" },
      { status: 400 }
    );
  }

  const [usage, budget, providerOk] = await Promise.all([
    getTokenUsageSummary({ period }),
    checkBudget(),
    isProviderAvailable(),
  ]);

  return NextResponse.json({
    usage,
    budget,
    providerAvailable: providerOk,
  });
}
