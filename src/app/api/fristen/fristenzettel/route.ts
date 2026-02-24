import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { de } from "date-fns/locale";

/**
 * GET /api/fristen/fristenzettel - Generate Fristenzettel PDF
 *
 * Query params:
 *   format: "daily" | "akte"
 *   datum: ISO date string (for daily format)
 *   akteId: string (for akte format)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pdfFormat = searchParams.get("format") ?? "daily";
  const datumStr = searchParams.get("datum");
  const akteId = searchParams.get("akteId");

  if (pdfFormat === "akte" && !akteId) {
    return NextResponse.json(
      { error: "akteId ist fuer Format 'akte' erforderlich" },
      { status: 400 }
    );
  }

  // Build where clause based on format
  const where: any = {
    typ: "FRIST",
    erledigt: false,
  };

  let title = "Fristenzettel";

  if (pdfFormat === "daily") {
    const targetDate = datumStr ? new Date(datumStr) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(dayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    where.datum = { gte: dayStart, lte: weekEnd };

    // Also include overdue entries
    where.OR = [
      { datum: { gte: dayStart, lte: weekEnd } },
      { datum: { lt: dayStart } },
    ];
    delete where.datum;

    title = `Fristenzettel -- ${format(dayStart, "dd.MM.yyyy", { locale: de })}`;
  } else if (pdfFormat === "akte") {
    where.akteId = akteId;
    title = `Fristenzettel -- Akte`;
  }

  const fristen = await prisma.kalenderEintrag.findMany({
    where,
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
      verantwortlich: { select: { name: true } },
    },
    orderBy: [{ datum: "asc" }],
  });

  // If akte format, update title with Aktenzeichen
  if (pdfFormat === "akte" && fristen.length > 0 && fristen[0].akte) {
    title = `Fristenzettel -- ${fristen[0].akte.aktenzeichen}`;
  }

  // Generate PDF
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 40;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header
  page.drawText(title, {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 10;

  page.drawText(`Erstellt: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: de })} Uhr`, {
    x: margin,
    y,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 25;

  // Column headers
  const cols = [
    { label: "Ampel", x: margin, w: 40 },
    { label: "Fristende", x: margin + 45, w: 80 },
    { label: "Aktenzeichen", x: margin + 130, w: 100 },
    { label: "Titel", x: margin + 235, w: 180 },
    { label: "Bundesland", x: margin + 420, w: 60 },
    { label: "Vorfristen", x: margin + 485, w: 120 },
    { label: "Verantwortlich", x: margin + 610, w: 100 },
    { label: "Prioritaet", x: margin + 715, w: 80 },
  ];

  // Draw header row
  page.drawRectangle({
    x: margin - 5,
    y: y - 4,
    width: pageWidth - 2 * margin + 10,
    height: 18,
    color: rgb(0.92, 0.92, 0.92),
  });

  for (const col of cols) {
    page.drawText(col.label, {
      x: col.x,
      y: y,
      size: 8,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  y -= 22;

  // Draw rows
  for (const frist of fristen) {
    // Check if we need a new page
    if (y < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const now = new Date();
    const datum = new Date(frist.datum);
    const diffDays = Math.ceil((datum.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Ampel color
    let ampelColor: [number, number, number];
    let ampelLabel: string;
    if (diffDays < 0) {
      ampelColor = [0.1, 0.1, 0.1]; // black/overdue
      ampelLabel = "!!";
    } else if (diffDays < 3) {
      ampelColor = [0.88, 0.27, 0.34]; // rose/red
      ampelLabel = "!";
    } else if (diffDays <= 7) {
      ampelColor = [0.92, 0.69, 0.0]; // amber/yellow
      ampelLabel = "~";
    } else {
      ampelColor = [0.16, 0.71, 0.47]; // emerald/green
      ampelLabel = "ok";
    }

    // Draw ampel circle
    page.drawCircle({
      x: cols[0].x + 10,
      y: y + 3,
      size: 5,
      color: rgb(...ampelColor),
    });
    page.drawText(ampelLabel, {
      x: cols[0].x + 20,
      y: y,
      size: 7,
      font: helvetica,
      color: rgb(...ampelColor),
    });

    // Fristende
    page.drawText(format(datum, "dd.MM.yyyy", { locale: de }), {
      x: cols[1].x,
      y: y,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Aktenzeichen
    const az = frist.akte?.aktenzeichen ?? "--";
    page.drawText(az.length > 15 ? az.substring(0, 15) + "..." : az, {
      x: cols[2].x,
      y: y,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Titel
    const titel = frist.titel;
    page.drawText(titel.length > 30 ? titel.substring(0, 30) + "..." : titel, {
      x: cols[3].x,
      y: y,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Bundesland
    page.drawText(frist.bundesland ?? "--", {
      x: cols[4].x,
      y: y,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Vorfristen
    const vfDates = frist.vorfristen
      .slice(0, 3)
      .map((d) => format(new Date(d), "dd.MM.", { locale: de }))
      .join(", ");
    page.drawText(vfDates || "--", {
      x: cols[5].x,
      y: y,
      size: 7,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Verantwortlich
    const verantw = frist.verantwortlich?.name ?? "--";
    page.drawText(verantw.length > 15 ? verantw.substring(0, 15) + "..." : verantw, {
      x: cols[6].x,
      y: y,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Prioritaet
    page.drawText(frist.prioritaet, {
      x: cols[7].x,
      y: y,
      size: 7,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Draw separator line
    y -= 4;
    page.drawLine({
      start: { x: margin - 5, y },
      end: { x: pageWidth - margin + 5, y },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;
  }

  // Empty state
  if (fristen.length === 0) {
    page.drawText("Keine laufenden Fristen gefunden.", {
      x: margin,
      y: y,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // Footer with total count
  if (y > margin + 30) {
    y -= 10;
    page.drawText(`Gesamt: ${fristen.length} Fristen`, {
      x: margin,
      y: y,
      size: 8,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  const pdfBytes = await pdfDoc.save();

  const filename = `Fristenzettel_${format(new Date(), "yyyy-MM-dd")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
