import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { AKTION_LABELS } from "@/lib/audit";

const MAX_EXPORT = 10_000;

/**
 * GET /api/admin/audit-trail/export - Export audit trail as CSV or PDF.
 * ADMIN only. Same filter params as main audit-trail route (no pagination).
 * Query param: format=csv|pdf
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const userId = searchParams.get("userId");
  const akteId = searchParams.get("akteId");
  const aktion = searchParams.get("aktion");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");

  // Build where clause
  const where: any = {};
  if (userId) where.userId = userId;
  if (akteId) where.akteId = akteId;
  if (aktion) where.aktion = aktion;
  if (von || bis) {
    where.createdAt = {};
    if (von) where.createdAt.gte = new Date(von);
    if (bis) {
      const bisDate = new Date(bis);
      bisDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = bisDate;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT,
    include: {
      user: { select: { name: true, role: true } },
      akte: { select: { aktenzeichen: true } },
    },
  });

  if (format === "pdf") {
    return generatePdf(logs, von, bis);
  }
  return generateCsv(logs);
}

function formatDe(date: Date): string {
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateCsv(
  logs: Array<{
    createdAt: Date;
    aktion: string;
    details: any;
    user: { name: string; role: string } | null;
    akte: { aktenzeichen: string } | null;
  }>
): NextResponse {
  const header = "Zeitpunkt;Benutzer;Rolle;Aktion;Akte;Details";
  const rows = logs.map((log) => {
    const zeit = formatDe(log.createdAt);
    const user = log.user?.name ?? "System";
    const rolle = log.user?.role ?? "";
    const action = AKTION_LABELS[log.aktion] ?? log.aktion;
    const akte = log.akte?.aktenzeichen ?? "";
    const details = log.details ? JSON.stringify(log.details).replace(/;/g, ",") : "";
    return `${zeit};${user};${rolle};${action};${akte};${details}`;
  });

  const csv = [header, ...rows].join("\n");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(csv);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-export.csv"`,
    },
  });
}

async function generatePdf(
  logs: Array<{
    createdAt: Date;
    aktion: string;
    details: any;
    user: { name: string; role: string } | null;
    akte: { aktenzeichen: string } | null;
  }>,
  von: string | null,
  bis: string | null
): Promise<NextResponse> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 portrait
  const pageHeight = 841.89;
  const margin = 40;
  const lineHeight = 14;
  const colWidths = [90, 100, 80, 130, 80, 35]; // Zeitpunkt, Benutzer, Rolle, Aktion, Akte, (row number)

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header
  page.drawText("Audit-Trail Export", { x: margin, y, font: fontBold, size: 16, color: rgb(0, 0, 0) });
  y -= 20;

  const dateRange = [
    von ? `von ${von}` : null,
    bis ? `bis ${bis}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  if (dateRange) {
    page.drawText(dateRange, { x: margin, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
  }
  page.drawText(`Erstellt: ${formatDe(new Date())} | ${logs.length} Eintraege`, {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 24;

  // Table header
  const headers = ["Zeitpunkt", "Benutzer", "Rolle", "Aktion", "Akte"];
  let x = margin;
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], { x, y, font: fontBold, size: 8, color: rgb(0, 0, 0) });
    x += colWidths[i];
  }
  y -= 4;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= lineHeight;

  // Table rows
  for (const log of logs) {
    if (y < margin + 20) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    x = margin;
    const row = [
      formatDe(log.createdAt),
      (log.user?.name ?? "System").substring(0, 18),
      (log.user?.role ?? "").substring(0, 12),
      (AKTION_LABELS[log.aktion] ?? log.aktion).substring(0, 28),
      (log.akte?.aktenzeichen ?? "").substring(0, 14),
    ];

    for (let i = 0; i < row.length; i++) {
      page.drawText(row[i], { x, y, font, size: 7, color: rgb(0.15, 0.15, 0.15) });
      x += colWidths[i];
    }
    y -= lineHeight;
  }

  const pdfBytes = await pdf.save();

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="audit-trail-export.pdf"`,
    },
  });
}
