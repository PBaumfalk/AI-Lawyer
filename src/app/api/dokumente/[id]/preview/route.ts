import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { previewQueue } from "@/lib/queue/queues";
import type { PreviewJobData } from "@/lib/ocr/types";

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
 * POST /api/dokumente/[id]/preview -- Manually re-trigger preview generation.
 *
 * Useful when:
 * - The original preview job failed (Stirling-PDF was down)
 * - The user wants to force regeneration
 *
 * Enqueues a new preview job to the BullMQ queue.
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

  // Enqueue preview generation job
  try {
    const previewJobData: PreviewJobData = {
      dokumentId: dokument.id,
      storagePath: dokument.dateipfad,
      mimeType: dokument.mimeType,
      fileName: dokument.name,
      akteId: dokument.akteId,
    };

    await previewQueue.add("generate-preview", previewJobData, {
      // Deduplicate: use dokumentId as jobId to avoid duplicate jobs
      jobId: `preview-${dokument.id}-${Date.now()}`,
    });

    return NextResponse.json({
      message: "Vorschau-Generierung gestartet",
      status: "generating",
    });
  } catch (err) {
    console.error(`[PREVIEW] Failed to enqueue preview job for ${id}:`, err);
    return NextResponse.json(
      { error: "Vorschau-Generierung konnte nicht gestartet werden" },
      { status: 500 }
    );
  }
}
