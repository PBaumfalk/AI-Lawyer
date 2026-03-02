/**
 * POST /api/dokumente/[id]/vision - AI-based vision text extraction from document images.
 * Sends the document image to the configured AI model for OCR via vision capabilities.
 * On success, saves extracted text and enqueues embedding job.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileStream } from "@/lib/storage";
import { getModel } from "@/lib/ai/provider";
import { generateText } from "ai";
import { embeddingQueue } from "@/lib/queue/queues";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id: dokumentId } = await params;

  // 1. Load document from DB
  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
    select: { id: true, akteId: true, dateipfad: true, mimeType: true, ocrStatus: true },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // 2. Validate MIME type is image (PDFs are not supported for vision)
  if (!dokument.mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Vision-Analyse ist nur fuer Bilddokumente verfuegbar" },
      { status: 400 }
    );
  }

  try {
    // 3. Fetch file from MinIO, convert to Buffer
    const stream = await getFileStream(dokument.dateipfad);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // 4. Call AI model with image
    const model = await getModel();
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: buffer,
              mimeType: dokument.mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
            },
            {
              type: "text",
              text: "Extrahiere den gesamten Text aus diesem Dokument. Gib nur den extrahierten Text zurueck, keine Kommentare oder Erklaerungen.",
            },
          ],
        },
      ],
      maxTokens: 4096,
    });

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Kein Text erkannt" }, { status: 422 });
    }

    // 5. Save extracted text
    await prisma.dokument.update({
      where: { id: dokumentId },
      data: {
        ocrText: text.trim(),
        ocrStatus: "ABGESCHLOSSEN",
        ocrFehler: null,
        ocrAbgeschlossen: new Date(),
      },
    });

    // 6. Enqueue embedding job (same pattern as OCR processor)
    await embeddingQueue.add("embed-document", {
      dokumentId,
      akteId: dokument.akteId,
      ocrText: text.trim(),
    });

    return NextResponse.json({ success: true, textLength: text.trim().length });
  } catch (err: unknown) {
    console.error("[VISION] Error:", err);
    const message =
      err instanceof Error
        ? err.message?.includes("vision") || err.message?.includes("image")
          ? "Das konfigurierte KI-Modell unterstuetzt keine Bilderkennung. Bitte OpenAI oder Anthropic als Provider konfigurieren."
          : err.message?.slice(0, 200) ?? "Vision-Analyse fehlgeschlagen"
        : "Vision-Analyse fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
