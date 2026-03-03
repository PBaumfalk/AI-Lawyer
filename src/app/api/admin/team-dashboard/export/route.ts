import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfWeek,
  eachWeekOfInterval,
  format,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";
import { de } from "date-fns/locale";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(date: Date): string {
  return format(date, "dd.MM.yyyy", { locale: de });
}

function deltaPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Count workdays (Mon-Fri) in interval */
function countWorkdays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface MonthlyReportData {
  monthLabel: string;
  monthStart: Date;
  monthEnd: Date;
  kanzlei: {
    name: string;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    telefon: string | null;
    email: string | null;
    website: string | null;
  };
  backlog: {
    weeks: Array<{ label: string; count: number; delta: number | null }>;
    endOfMonthCount: number;
  };
  billing: {
    thisCount: number;
    thisTotal: number;
    prevCount: number;
    prevTotal: number;
    deltaPercent: number;
  };
  questRate: number;
  optInCount: number;
}

// ── Data Gathering ─────────────────────────────────────────────────────────

async function gatherMonthlyReport(
  kanzleiId: string,
): Promise<MonthlyReportData> {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const monthStart = startOfMonth(lastMonth);
  const monthEnd = endOfMonth(lastMonth);
  const prevMonthStart = startOfMonth(subMonths(lastMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(lastMonth, 1));
  const monthLabel = format(lastMonth, "MMMM yyyy", { locale: de });

  // 1. Kanzlei for Briefkopf
  const kanzlei = await prisma.kanzlei.findUnique({
    where: { id: kanzleiId },
    select: {
      name: true,
      strasse: true,
      plz: true,
      ort: true,
      telefon: true,
      email: true,
      website: true,
    },
  });

  if (!kanzlei) {
    throw new Error("Kanzlei nicht gefunden");
  }

  // 2. Backlog per week (WeeklySnapshot for Wiedervorlage)
  const weeksInMonth = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 },
  );

  const snapshots = await prisma.weeklySnapshot.findMany({
    where: {
      model: "Wiedervorlage",
      weekStart: { gte: weeksInMonth[0], lte: monthEnd },
      userId: null, // kanzlei-wide
    },
    orderBy: { weekStart: "asc" },
  });

  const snapshotMap = new Map(
    snapshots.map((s) => [s.weekStart.toISOString(), s.count]),
  );

  const backlogWeeks: Array<{
    label: string;
    count: number;
    delta: number | null;
  }> = [];

  for (let i = 0; i < weeksInMonth.length; i++) {
    const ws = weeksInMonth[i];
    const count = snapshotMap.get(ws.toISOString()) ?? 0;
    const prevCount =
      i > 0
        ? snapshotMap.get(weeksInMonth[i - 1].toISOString()) ?? 0
        : null;
    backlogWeeks.push({
      label: format(ws, "dd.MM.", { locale: de }),
      count,
      delta: prevCount !== null ? count - prevCount : null,
    });
  }

  const endOfMonthCount =
    backlogWeeks.length > 0
      ? backlogWeeks[backlogWeeks.length - 1].count
      : 0;

  // 3. Billing delta
  const [thisMonthBilling, prevMonthBilling] = await Promise.all([
    prisma.rechnung.aggregate({
      where: {
        akte: { kanzleiId },
        rechnungsdatum: { gte: monthStart, lte: monthEnd },
        status: { not: "STORNIERT" },
      },
      _sum: { betragNetto: true },
      _count: { id: true },
    }),
    prisma.rechnung.aggregate({
      where: {
        akte: { kanzleiId },
        rechnungsdatum: { gte: prevMonthStart, lte: prevMonthEnd },
        status: { not: "STORNIERT" },
      },
      _sum: { betragNetto: true },
      _count: { id: true },
    }),
  ]);

  const thisTotal = Number(thisMonthBilling._sum.betragNetto ?? 0);
  const prevTotal = Number(prevMonthBilling._sum.betragNetto ?? 0);

  // 4. Quest fulfillment rate for the month
  const optedInUsers = await prisma.user.findMany({
    where: { kanzleiId, gamificationOptIn: true, aktiv: true },
    select: { id: true },
  });

  const dailyQuests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    select: { id: true },
  });

  const workdays = countWorkdays(monthStart, monthEnd);
  const optInCount = optedInUsers.length;

  let questRate = 0;
  if (optInCount > 0 && dailyQuests.length > 0 && workdays > 0) {
    const totalCompletions = await prisma.questCompletion.count({
      where: {
        quest: { typ: "DAILY" },
        userId: { in: optedInUsers.map((u) => u.id) },
        completedDate: { gte: monthStart, lte: monthEnd },
      },
    });
    // Total possible = quests * users * workdays
    const totalPossible = dailyQuests.length * optInCount * workdays;
    questRate = Math.round((totalCompletions / totalPossible) * 100);
    if (questRate > 100) questRate = 100; // cap
  }

  return {
    monthLabel,
    monthStart,
    monthEnd,
    kanzlei,
    backlog: { weeks: backlogWeeks, endOfMonthCount },
    billing: {
      thisCount: thisMonthBilling._count.id,
      thisTotal,
      prevCount: prevMonthBilling._count.id,
      prevTotal,
      deltaPercent: deltaPercent(thisTotal, prevTotal),
    },
    questRate,
    optInCount,
  };
}

// ── CSV Generation ─────────────────────────────────────────────────────────

function generateCsv(data: MonthlyReportData): NextResponse {
  const lines: string[] = [];

  // Summary header
  lines.push("Metrik;Wert;Vergleich;Delta");
  lines.push(
    `Backlog (Monatsende);${data.backlog.endOfMonthCount};;`,
  );
  lines.push(
    `Rechnungen (Anzahl);${data.billing.thisCount};${data.billing.prevCount};${data.billing.thisCount - data.billing.prevCount}`,
  );
  lines.push(
    `Rechnungen (Netto);${formatCurrency(data.billing.thisTotal)};${formatCurrency(data.billing.prevTotal)};${data.billing.deltaPercent}%`,
  );
  lines.push(`Quest-Erfuellungsquote;${data.questRate}%;;`);

  // Blank line before weekly breakdown
  lines.push("");
  lines.push("Woche;Backlog-Offen;Backlog-Delta");

  for (const week of data.backlog.weeks) {
    lines.push(
      `${week.label};${week.count};${week.delta !== null ? (week.delta >= 0 ? `+${week.delta}` : `${week.delta}`) : "-"}`,
    );
  }

  const csv = lines.join("\n");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(csv);

  const filename = `team-report-${format(data.monthStart, "MMMM-yyyy", { locale: de })}.csv`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── PDF Generation ─────────────────────────────────────────────────────────

async function generatePdf(data: MonthlyReportData): Promise<NextResponse> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginLeft = 56.69; // ~20mm
  const marginRight = 56.69;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56.69;

  // Helper: ensure enough space, otherwise add a new page
  const ensureSpace = (needed: number) => {
    if (y < 60 + needed) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56.69;
    }
  };

  // Helper: draw horizontal line
  const drawLine = (yPos: number, thickness = 0.5) => {
    page.drawLine({
      start: { x: marginLeft, y: yPos },
      end: { x: pageWidth - marginRight, y: yPos },
      thickness,
      color: rgb(0.7, 0.7, 0.7),
    });
  };

  // ── 1. Briefkopf ──
  page.drawText(data.kanzlei.name, {
    x: marginLeft,
    y,
    font: fontBold,
    size: 16,
    color: rgb(0, 0, 0),
  });
  y -= 16;

  // Address line
  const addressParts = [
    data.kanzlei.strasse,
    [data.kanzlei.plz, data.kanzlei.ort].filter(Boolean).join(" "),
    data.kanzlei.telefon ? `Tel: ${data.kanzlei.telefon}` : null,
    data.kanzlei.email,
  ].filter(Boolean);
  if (addressParts.length > 0) {
    page.drawText(addressParts.join(" | "), {
      x: marginLeft,
      y,
      font,
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  }

  y -= 8;
  drawLine(y, 1);
  y -= 20;

  // ── 2. Title ──
  page.drawText(`Team-Report ${data.monthLabel}`, {
    x: marginLeft,
    y,
    font: fontBold,
    size: 14,
    color: rgb(0, 0, 0),
  });
  y -= 16;

  // Generation date
  page.drawText(`Erstellt: ${formatDate(new Date())}`, {
    x: marginLeft,
    y,
    font,
    size: 8,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 10;
  page.drawText(
    `Berichtszeitraum: ${formatDate(data.monthStart)} - ${formatDate(data.monthEnd)}`,
    {
      x: marginLeft,
      y,
      font,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    },
  );
  y -= 24;

  // ── 3. Section: Backlog-Delta ──
  ensureSpace(80);
  page.drawText("1. Backlog-Delta (Offene Wiedervorlagen)", {
    x: marginLeft,
    y,
    font: fontBold,
    size: 11,
    color: rgb(0, 0, 0),
  });
  y -= 18;

  if (data.backlog.weeks.length === 0) {
    page.drawText("Keine Daten fuer diesen Zeitraum.", {
      x: marginLeft,
      y,
      font,
      size: 9,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 14;
  } else {
    // Table header
    const colX = [marginLeft, marginLeft + 120, marginLeft + 260];
    const colHeaders = ["Woche", "Offene WV", "Delta"];

    for (let i = 0; i < colHeaders.length; i++) {
      page.drawText(colHeaders[i], {
        x: colX[i],
        y,
        font: fontBold,
        size: 8,
        color: rgb(0, 0, 0),
      });
    }
    y -= 4;
    drawLine(y);
    y -= 12;

    for (const week of data.backlog.weeks) {
      ensureSpace(14);
      page.drawText(week.label, {
        x: colX[0],
        y,
        font,
        size: 8,
        color: rgb(0.15, 0.15, 0.15),
      });
      page.drawText(String(week.count), {
        x: colX[1],
        y,
        font,
        size: 8,
        color: rgb(0.15, 0.15, 0.15),
      });
      const deltaStr =
        week.delta !== null
          ? week.delta >= 0
            ? `+${week.delta}`
            : `${week.delta}`
          : "-";
      const deltaColor =
        week.delta !== null && week.delta > 0
          ? rgb(0.8, 0.2, 0.2) // rose for increase
          : week.delta !== null && week.delta < 0
            ? rgb(0.1, 0.6, 0.3) // emerald for decrease
            : rgb(0.4, 0.4, 0.4);
      page.drawText(deltaStr, {
        x: colX[2],
        y,
        font,
        size: 8,
        color: deltaColor,
      });
      y -= 14;
    }

    // Summary
    y -= 4;
    page.drawText(
      `Monatsende-Stand: ${data.backlog.endOfMonthCount} offene Wiedervorlagen`,
      {
        x: marginLeft,
        y,
        font,
        size: 9,
        color: rgb(0.15, 0.15, 0.15),
      },
    );
    y -= 14;
  }
  y -= 10;

  // ── 4. Section: Billing-Delta ──
  ensureSpace(80);
  page.drawText("2. Billing-Delta (Rechnungen)", {
    x: marginLeft,
    y,
    font: fontBold,
    size: 11,
    color: rgb(0, 0, 0),
  });
  y -= 18;

  page.drawText(
    `Rechnungen: ${data.billing.thisCount} (${formatCurrency(data.billing.thisTotal)})`,
    {
      x: marginLeft,
      y,
      font,
      size: 9,
      color: rgb(0.15, 0.15, 0.15),
    },
  );
  y -= 14;

  page.drawText(
    `Vormonat: ${data.billing.prevCount} (${formatCurrency(data.billing.prevTotal)})`,
    {
      x: marginLeft,
      y,
      font,
      size: 9,
      color: rgb(0.15, 0.15, 0.15),
    },
  );
  y -= 14;

  const billingDeltaColor =
    data.billing.deltaPercent > 0
      ? rgb(0.1, 0.6, 0.3) // green = billing up is good
      : data.billing.deltaPercent < 0
        ? rgb(0.8, 0.2, 0.2)
        : rgb(0.4, 0.4, 0.4);
  page.drawText(
    `Delta: ${data.billing.deltaPercent >= 0 ? "+" : ""}${data.billing.deltaPercent}%`,
    {
      x: marginLeft,
      y,
      font: fontBold,
      size: 9,
      color: billingDeltaColor,
    },
  );
  y -= 24;

  // ── 5. Section: Quest-Erfuellungsquote ──
  ensureSpace(60);
  page.drawText("3. Quest-Erfuellungsquote", {
    x: marginLeft,
    y,
    font: fontBold,
    size: 11,
    color: rgb(0, 0, 0),
  });
  y -= 18;

  page.drawText(`Team-Erfuellungsquote: ${data.questRate}%`, {
    x: marginLeft,
    y,
    font,
    size: 9,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 14;

  page.drawText(`Opt-in Nutzer: ${data.optInCount}`, {
    x: marginLeft,
    y,
    font,
    size: 9,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 30;

  // ── 6. Footer ──
  drawLine(y, 0.5);
  y -= 14;
  page.drawText(
    `Generiert am ${formatDate(new Date())} um ${format(new Date(), "HH:mm", { locale: de })} Uhr`,
    {
      x: marginLeft,
      y,
      font,
      size: 7,
      color: rgb(0.5, 0.5, 0.5),
    },
  );

  const pdfBytes = await pdf.save();

  const filename = `team-report-${format(data.monthStart, "MMMM-yyyy", { locale: de })}.pdf`;

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── GET Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/team-dashboard/export
 *
 * Query params:
 *   format=pdf|csv (default: csv)
 *
 * ADMIN only. Generates a monthly report for last calendar month.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const kanzleiId = (session.user as any).kanzleiId as string | null;
  if (!kanzleiId) {
    return NextResponse.json(
      { error: "Keine Kanzlei zugeordnet" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fmt = searchParams.get("format") ?? "csv";

  try {
    const data = await gatherMonthlyReport(kanzleiId);

    if (fmt === "pdf") {
      return await generatePdf(data);
    }
    return generateCsv(data);
  } catch (error) {
    console.error("[team-dashboard/export]", error);
    return NextResponse.json(
      { error: "Export fehlgeschlagen" },
      { status: 500 },
    );
  }
}
