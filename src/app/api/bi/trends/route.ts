import { NextRequest, NextResponse } from "next/server";
import { resolveBiRequest } from "@/lib/bi/request";
import { getTrendData } from "@/lib/bi/kpi-queries";
import type { BiTrendResponse } from "@/lib/bi/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-bi-trends");

// GET /api/bi/trends -- return trend series for BI dashboard charts
export async function GET(request: NextRequest) {
  const bi = await resolveBiRequest(request);
  if (bi.error) return bi.error;
  const { filters, scope, userId } = bi;

  try {

    const series = await getTrendData(filters, scope, userId);

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
