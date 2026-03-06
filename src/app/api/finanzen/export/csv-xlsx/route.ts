import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { generateCsv } from "@/lib/export/csv-export";
import { generateXlsx } from "@/lib/export/xlsx-export";
import type { ExportFormat, ExportConfig } from "@/lib/export/types";

type FinanzExportType = "rechnungen" | "buchungen" | "zeiterfassung";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("de-DE");
}

function formatDecimal(val: any): string {
  if (val === null || val === undefined) return "";
  return Number(val).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const RECHNUNGEN_CONFIG: ExportConfig = {
  filename: "finanzen-rechnungen",
  sheetName: "Rechnungen",
  columns: [
    { key: "rechnungsnummer", header: "Rechnungsnummer", width: 20 },
    { key: "aktenzeichen", header: "Aktenzeichen", width: 20 },
    { key: "rechnungsdatum", header: "Rechnungsdatum", width: 16 },
    { key: "betragNetto", header: "Netto (EUR)", width: 14 },
    { key: "betragBrutto", header: "Brutto (EUR)", width: 14 },
    { key: "status", header: "Status", width: 14 },
    { key: "typ", header: "Typ", width: 14 },
  ],
};

const BUCHUNGEN_CONFIG: ExportConfig = {
  filename: "finanzen-buchungen",
  sheetName: "Buchungen",
  columns: [
    { key: "buchungsdatum", header: "Datum", width: 14 },
    { key: "aktenzeichen", header: "Aktenzeichen", width: 20 },
    { key: "betrag", header: "Betrag (EUR)", width: 14 },
    { key: "buchungstyp", header: "Typ", width: 14 },
    { key: "verwendungszweck", header: "Verwendungszweck", width: 30 },
    { key: "belegnummer", header: "Belegnummer", width: 16 },
  ],
};

const ZEITERFASSUNG_CONFIG: ExportConfig = {
  filename: "finanzen-zeiterfassung",
  sheetName: "Zeiterfassung",
  columns: [
    { key: "datum", header: "Datum", width: 14 },
    { key: "aktenzeichen", header: "Aktenzeichen", width: 20 },
    { key: "bearbeiter", header: "Bearbeiter", width: 22 },
    { key: "dauer", header: "Dauer (Min)", width: 12 },
    { key: "beschreibung", header: "Beschreibung", width: 40 },
    { key: "abrechenbar", header: "Abrechenbar", width: 12 },
  ],
};

// GET /api/finanzen/export/csv-xlsx?format=csv|xlsx&type=rechnungen|buchungen|zeiterfassung
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv") as ExportFormat;
  const exportType = searchParams.get("type") as FinanzExportType | null;

  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { error: "Ungueltiges Format. Erlaubt: csv, xlsx" },
      { status: 400 }
    );
  }

  if (!exportType || !["rechnungen", "buchungen", "zeiterfassung"].includes(exportType)) {
    return NextResponse.json(
      { error: "Ungueltiger Typ. Erlaubt: rechnungen, buchungen, zeiterfassung" },
      { status: 400 }
    );
  }

  let data: Record<string, any>[] = [];
  let config: ExportConfig;

  switch (exportType) {
    case "rechnungen": {
      const rechnungen = await prisma.rechnung.findMany({
        include: { akte: { select: { aktenzeichen: true } } },
        orderBy: { rechnungsdatum: "desc" },
      });
      data = rechnungen.map((r) => ({
        rechnungsnummer: r.rechnungsnummer,
        aktenzeichen: r.akte.aktenzeichen,
        rechnungsdatum: formatDate(r.rechnungsdatum),
        betragNetto: formatDecimal(r.betragNetto),
        betragBrutto: formatDecimal(r.betragBrutto),
        status: r.status,
        typ: r.typ,
      }));
      config = RECHNUNGEN_CONFIG;
      break;
    }

    case "buchungen": {
      const buchungen = await prisma.aktenKontoBuchung.findMany({
        include: { akte: { select: { aktenzeichen: true } } },
        orderBy: { buchungsdatum: "desc" },
      });
      data = buchungen.map((b) => ({
        buchungsdatum: formatDate(b.buchungsdatum),
        aktenzeichen: b.akte.aktenzeichen,
        betrag: formatDecimal(b.betrag),
        buchungstyp: b.buchungstyp,
        verwendungszweck: b.verwendungszweck,
        belegnummer: b.belegnummer ?? "",
      }));
      config = BUCHUNGEN_CONFIG;
      break;
    }

    case "zeiterfassung": {
      const zeiterfassungen = await prisma.zeiterfassung.findMany({
        include: {
          akte: { select: { aktenzeichen: true } },
          user: { select: { name: true } },
        },
        orderBy: { datum: "desc" },
      });
      data = zeiterfassungen.map((z) => ({
        datum: formatDate(z.datum),
        aktenzeichen: z.akte.aktenzeichen,
        bearbeiter: z.user.name ?? "",
        dauer: z.dauer,
        beschreibung: z.beschreibung,
        abrechenbar: z.abrechenbar ? "Ja" : "Nein",
      }));
      config = ZEITERFASSUNG_CONFIG;
      break;
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${config.filename}-${dateStr}`;

  if (format === "csv") {
    const csv = generateCsv(data, config);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const buffer = await generateXlsx(data, config);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
