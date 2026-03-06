import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { generateCsv } from "@/lib/export/csv-export";
import { generateXlsx } from "@/lib/export/xlsx-export";
import type { ExportFormat, ExportConfig } from "@/lib/export/types";

const AKTEN_EXPORT_CONFIG: ExportConfig = {
  filename: "akten-export",
  sheetName: "Akten",
  columns: [
    { key: "aktenzeichen", header: "Aktenzeichen", width: 20 },
    { key: "kurzrubrum", header: "Kurzrubrum", width: 30 },
    { key: "sachgebiet", header: "Sachgebiet", width: 18 },
    { key: "status", header: "Status", width: 14 },
    { key: "anwalt", header: "Anwalt", width: 22 },
    { key: "beteiligte", header: "Beteiligte", width: 30 },
    { key: "erstellt", header: "Erstellt", width: 14 },
    { key: "geaendert", header: "Geaendert", width: 14 },
  ],
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("de-DE");
}

// GET /api/akten/export?format=csv|xlsx
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv") as ExportFormat;
  const status = searchParams.get("status");
  const sachgebiet = searchParams.get("sachgebiet");
  const anwaltId = searchParams.get("anwaltId");

  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { error: "Ungueltiges Format. Erlaubt: csv, xlsx" },
      { status: 400 }
    );
  }

  // Build access filter based on user role
  const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
  const where: any = { ...accessFilter };
  if (status) where.status = status;
  if (sachgebiet) where.sachgebiet = sachgebiet;
  if (anwaltId) where.anwaltId = anwaltId;

  const akten = await prisma.akte.findMany({
    where,
    include: {
      anwalt: { select: { name: true } },
      beteiligte: {
        include: {
          kontakt: {
            select: { vorname: true, nachname: true, firma: true },
          },
        },
        take: 5,
      },
    },
    orderBy: { geaendert: "desc" },
  });

  // Transform to flat export data
  const data = akten.map((akte) => ({
    aktenzeichen: akte.aktenzeichen,
    kurzrubrum: akte.kurzrubrum,
    sachgebiet: akte.sachgebiet,
    status: akte.status,
    anwalt: akte.anwalt?.name ?? "",
    beteiligte: akte.beteiligte
      .map((b) => {
        const k = b.kontakt;
        if (k.firma) return k.firma;
        return [k.vorname, k.nachname].filter(Boolean).join(" ");
      })
      .join(", "),
    erstellt: formatDate(akte.angelegt),
    geaendert: formatDate(akte.geaendert),
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${AKTEN_EXPORT_CONFIG.filename}-${dateStr}`;

  if (format === "csv") {
    const csv = generateCsv(data, AKTEN_EXPORT_CONFIG);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const buffer = await generateXlsx(data, AKTEN_EXPORT_CONFIG);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
