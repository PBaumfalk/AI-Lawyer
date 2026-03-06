import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { generateCsv } from "@/lib/export/csv-export";
import { generateXlsx } from "@/lib/export/xlsx-export";
import type { ExportFormat, ExportConfig } from "@/lib/export/types";

const KONTAKTE_EXPORT_CONFIG: ExportConfig = {
  filename: "kontakte-export",
  sheetName: "Kontakte",
  columns: [
    { key: "name", header: "Name", width: 28 },
    { key: "firma", header: "Firma", width: 24 },
    { key: "strasse", header: "Strasse", width: 24 },
    { key: "plz", header: "PLZ", width: 8 },
    { key: "ort", header: "Ort", width: 18 },
    { key: "telefon", header: "Telefon", width: 18 },
    { key: "email", header: "E-Mail", width: 28 },
    { key: "typ", header: "Typ", width: 14 },
  ],
};

// GET /api/kontakte/export?format=csv|xlsx
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv") as ExportFormat;
  const typ = searchParams.get("typ");
  const q = searchParams.get("q");

  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { error: "Ungueltiges Format. Erlaubt: csv, xlsx" },
      { status: 400 }
    );
  }

  const where: any = {};
  if (typ) where.typ = typ;
  if (q) {
    where.OR = [
      { nachname: { contains: q, mode: "insensitive" } },
      { vorname: { contains: q, mode: "insensitive" } },
      { firma: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const kontakte = await prisma.kontakt.findMany({
    where,
    orderBy: [{ nachname: "asc" }, { firma: "asc" }],
  });

  // Transform to flat export data
  const data = kontakte.map((k) => ({
    name: k.typ === "JURISTISCH"
      ? (k.firma ?? "")
      : [k.vorname, k.nachname].filter(Boolean).join(" "),
    firma: k.firma ?? "",
    strasse: k.strasse ?? "",
    plz: k.plz ?? "",
    ort: k.ort ?? "",
    telefon: k.telefon ?? "",
    email: k.email ?? "",
    typ: k.typ === "NATUERLICH" ? "Natuerliche Person" : "Juristische Person",
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${KONTAKTE_EXPORT_CONFIG.filename}-${dateStr}`;

  if (format === "csv") {
    const csv = generateCsv(data, KONTAKTE_EXPORT_CONFIG);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const buffer = await generateXlsx(data, KONTAKTE_EXPORT_CONFIG);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
