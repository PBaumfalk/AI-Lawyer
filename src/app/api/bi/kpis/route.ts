import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import {
  parseBiFilters,
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
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseBiFilters(searchParams);
    const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
    const userId = session.user.id;

    const [akten, finanzen, fristen, helena] = await Promise.all([
      getAktenKpis(filters, accessFilter, userId),
      getFinanzenKpis(filters, accessFilter, userId),
      getFristenKpis(filters, accessFilter, userId),
      getHelenaKpis(filters, accessFilter, userId),
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
