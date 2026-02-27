import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canConvertToPdf, generatePreviewWithBriefkopf } from "@/lib/onlyoffice";

/**
 * GET /api/dokumente/[id]/preview -- Get a PDF preview URL for the document.
 *
 * Returns proxy URLs (Next.js streams from MinIO internally).
 * Browser never talks to MinIO directly.
 *
 * - PDF files: returns /api/dokumente/[id]?inline=true
 * - Non-PDF with previewPfad: returns /api/dokumente/[id]?preview=true
 * - Non-PDF without previewPfad: returns 202 (preview still generating)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: { id: true, mimeType: true, previewPfad: true },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // PDF files -- proxy through Next.js inline
  if (dokument.mimeType === "application/pdf") {
    return NextResponse.json({
      url: `/api/dokumente/${id}?inline=true`,
      status: "ready",
    });
  }

  // Non-PDF with a generated preview -- proxy preview PDF inline
  if (dokument.previewPfad) {
    return NextResponse.json({
      url: `/api/dokumente/${id}?preview=true`,
      status: "ready",
    });
  }

  // Non-PDF without preview yet -- still generating
  return NextResponse.json(
    { url: null, status: "generating" },
    { status: 202 }
  );
}

/**
 * POST /api/dokumente/[id]/preview -- Generate PDF preview via OnlyOffice.
 *
 * Converts the document to PDF using OnlyOffice's Conversion API (synchronous,
 * no worker/queue required). Stores the result in MinIO and updates previewPfad.
 *
 * This replaces the previous BullMQ + Stirling-PDF approach which required
 * the worker container and Stirling-PDF Docker service to be running.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: {
      id: true,
      mimeType: true,
      dateipfad: true,
      name: true,
      akteId: true,
      previewPfad: true,
    },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  if (dokument.mimeType === "application/pdf") {
    return NextResponse.json({
      message: "PDF-Dateien benoetigen keine Vorschau-Generierung",
      status: "ready",
    });
  }

  // If preview already exists, return it
  if (dokument.previewPfad) {
    return NextResponse.json({
      url: `/api/dokumente/${id}?preview=true`,
      status: "ready",
    });
  }

  // Check if this MIME type can be converted via OnlyOffice
  if (!canConvertToPdf(dokument.mimeType)) {
    return NextResponse.json(
      { error: "Dieser Dateityp kann nicht in eine PDF-Vorschau konvertiert werden" },
      { status: 422 }
    );
  }

  // Convert via OnlyOffice with Briefkopf injection
  try {
    console.log(`[PREVIEW] Generating preview with Briefkopf for ${dokument.name}`);
    await generatePreviewWithBriefkopf(dokument.id);

    return NextResponse.json({
      url: `/api/dokumente/${id}?preview=true`,
      status: "ready",
    });
  } catch (err) {
    console.error(`[PREVIEW] Failed to generate preview for ${id}:`, err);
    return NextResponse.json(
      { error: "Vorschau-Generierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
