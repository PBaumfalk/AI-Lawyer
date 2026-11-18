import { NextRequest, NextResponse } from "next/server";
import { resolveBiRequest } from "@/lib/bi/request";
import {
  getAktenKpis,
  getFinanzenKpis,
  getFristenKpis,
  getHelenaKpis,
  getTrendData,
} from "@/lib/bi/kpi-queries";
import { generateBiXlsxReport } from "@/lib/bi/xlsx-report";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-bi-export-xlsx");

// GET /api/bi/export/xlsx -- generate and download BI XLSX report
export async function GET(request: NextRequest) {
  const bi = await resolveBiRequest(request);
  if (bi.error) return bi.error;
  const { filters, scope, userId } = bi;

  try {

    // Fetch all KPI data and trends in parallel
    const [akten, finanzen, fristen, helena, trends] = await Promise.all([
      getAktenKpis(filters, scope, userId),
      getFinanzenKpis(filters, scope, userId),
      getFristenKpis(filters, scope, userId),
      getHelenaKpis(filters, scope, userId),
      getTrendData(filters, scope, userId),
    ]);

    const tiles = [...akten, ...finanzen, ...fristen, ...helena];
    const zeitraum = {
      von: filters.current.von.toISOString(),
      bis: filters.current.bis.toISOString(),
    };

    const xlsxBuffer = await generateBiXlsxReport(tiles, trends, zeitraum);

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bi-report-${today}.xlsx"`,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to generate BI XLSX report");
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Excel-Reports" },
      { status: 500 }
    );
  }
}
