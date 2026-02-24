/**
 * POST /api/dokumente/[id]/ocr - Manually retry OCR processing for a document.
 * Resets OCR status and enqueues a new OCR job.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ocrQueue } from "@/lib/queue/queues";
import type { OcrJobData } from "@/lib/ocr/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: {
      id: true,
      akteId: true,
      dateipfad: true,
      mimeType: true,
      name: true,
      ocrStatus: true,
    },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // Reset OCR status
  const updated = await prisma.dokument.update({
    where: { id },
    data: {
      ocrStatus: "AUSSTEHEND",
      ocrVersuche: 0,
      ocrFehler: null,
    },
    select: { id: true, ocrStatus: true },
  });

  // Enqueue new OCR job
  const jobData: OcrJobData = {
    dokumentId: dokument.id,
    akteId: dokument.akteId,
    storagePath: dokument.dateipfad,
    mimeType: dokument.mimeType,
    fileName: dokument.name,
  };

  await ocrQueue.add("ocr-document", jobData);

  return NextResponse.json({
    message: "OCR erneut gestartet",
    ocrStatus: updated.ocrStatus,
  });
}
