import { NextRequest, NextResponse } from "next/server";
import { resolveBiRequest } from "@/lib/bi/request";
import {
  getAktenKpis,
  getFinanzenKpis,
  getFristenKpis,
  getHelenaKpis,
  getTrendData,
} from "@/lib/bi/kpi-queries";
import { generateBiPdfReport } from "@/lib/bi/pdf-report";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-bi-export-pdf");

// GET /api/bi/export/pdf -- generate and download BI PDF report
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

    // Use session user name as kanzlei hint (no dedicated settings table)
    const pdfBuffer = generateBiPdfReport(tiles, trends, zeitraum);

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bi-report-${today}.pdf"`,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to generate BI PDF report");
    return NextResponse.json(
      { error: "Fehler beim Erstellen des PDF-Reports" },
      { status: 500 }
    );
  }
}
