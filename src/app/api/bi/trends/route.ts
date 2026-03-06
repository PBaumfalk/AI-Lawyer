import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { parseBiFilters, getTrendData } from "@/lib/bi/kpi-queries";
import type { BiTrendResponse } from "@/lib/bi/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-bi-trends");

// GET /api/bi/trends -- return trend series for BI dashboard charts
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseBiFilters(searchParams);
    const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
    const userId = session.user.id;

    const series = await getTrendData(filters, accessFilter, userId);

    const response: BiTrendResponse = {
      series,
      zeitraum: {
        von: filters.current.von.toISOString(),
        bis: filters.current.bis.toISOString(),
      },
      cached: false,
    };

    return NextResponse.json(response);
  } catch (err) {
    log.error({ err }, "Failed to fetch BI trends");
    return NextResponse.json(
      { error: "Fehler beim Laden der Trend-Daten" },
      { status: 500 }
    );
  }
}
