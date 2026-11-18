import { NextRequest, NextResponse } from "next/server";
import { resolveBiRequest } from "@/lib/bi/request";
import {
  getAktenKpis,
  getFinanzenKpis,
  getFristenKpis,
  getHelenaKpis,
} from "@/lib/bi/kpi-queries";
import type { BiKpiResponse } from "@/lib/bi/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-bi-kpis");

// GET /api/bi/kpis -- return all KPI tiles for BI dashboard
export async function GET(request: NextRequest) {
  const bi = await resolveBiRequest(request);
  if (bi.error) return bi.error;
  const { filters, scope, userId } = bi;

  try {

    const [akten, finanzen, fristen, helena] = await Promise.all([
      getAktenKpis(filters, scope, userId),
      getFinanzenKpis(filters, scope, userId),
      getFristenKpis(filters, scope, userId),
      getHelenaKpis(filters, scope, userId),
    ]);

    const response: BiKpiResponse = {
      tiles: [...akten, ...finanzen, ...fristen, ...helena],
      zeitraum: {
        von: filters.current.von.toISOString(),
        bis: filters.current.bis.toISOString(),
      },
      cached: false, // Individual queries track caching internally
    };

    return NextResponse.json(response);
  } catch (err) {
    log.error({ err }, "Failed to fetch BI KPIs");
    return NextResponse.json(
      { error: "Fehler beim Laden der KPI-Daten" },
      { status: 500 }
    );
  }
}
