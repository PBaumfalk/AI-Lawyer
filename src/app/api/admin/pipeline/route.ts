/**
 * Admin pipeline dashboard API.
 * GET: Returns OCR/embedding queue stats and failed documents.
 * POST: Bulk retry of all failed OCR documents.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ocrQueue, embeddingQueue, previewQueue } from "@/lib/queue/queues";
import type { OcrJobData } from "@/lib/ocr/types";

/**
 * GET /api/admin/pipeline - Get pipeline statistics and failed documents.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    // Get queue stats
    const [ocrCounts, embeddingCounts, previewCounts] = await Promise.all([
      ocrQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      embeddingQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      previewQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    ]);

    // Get failed OCR documents
    const failedDocuments = await prisma.dokument.findMany({
      where: { ocrStatus: "FEHLGESCHLAGEN" },
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        ocrFehler: true,
        ocrVersuche: true,
        akteId: true,
        updatedAt: true,
        akte: { select: { aktenzeichen: true, kurzrubrum: true } },
      },
    });

    // Get OCR status distribution
    const statusCounts = await prisma.dokument.groupBy({
      by: ["ocrStatus"],
      _count: { id: true },
    });

    return NextResponse.json({
      queues: {
        ocr: ocrCounts,
        embedding: embeddingCounts,
        preview: previewCounts,
      },
      failedDocuments,
      statusDistribution: statusCounts.reduce(
        (acc, item) => {
          acc[item.ocrStatus] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Pipeline-Status konnte nicht geladen werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pipeline - Bulk operations on the pipeline.
 * Supports: { action: "retry-all-failed" }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (body.action === "retry-all-failed") {
      // Find all failed OCR documents
      const failed = await prisma.dokument.findMany({
        where: { ocrStatus: "FEHLGESCHLAGEN" },
        select: {
          id: true,
          akteId: true,
          dateipfad: true,
          mimeType: true,
          name: true,
        },
      });

      if (failed.length === 0) {
        return NextResponse.json({
          message: "Keine fehlgeschlagenen Dokumente gefunden",
          count: 0,
        });
      }

      // Reset all failed documents and enqueue new OCR jobs
      await prisma.dokument.updateMany({
        where: { ocrStatus: "FEHLGESCHLAGEN" },
        data: {
          ocrStatus: "AUSSTEHEND",
          ocrVersuche: 0,
          ocrFehler: null,
        },
      });

      // Enqueue OCR jobs for all failed documents
      for (const doc of failed) {
        const jobData: OcrJobData = {
          dokumentId: doc.id,
          akteId: doc.akteId,
          storagePath: doc.dateipfad,
          mimeType: doc.mimeType,
          fileName: doc.name,
        };
        await ocrQueue.add("ocr-document", jobData);
      }

      return NextResponse.json({
        message: `${failed.length} Dokument(e) werden erneut verarbeitet`,
        count: failed.length,
      });
    }

    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Pipeline-Aktion fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
