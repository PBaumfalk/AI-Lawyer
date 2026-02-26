/**
 * OCR job processor.
 * Fetches documents from MinIO, routes by MIME type to Stirling-PDF,
 * stores OCR'd text, indexes in Meilisearch, and chains to embedding queue.
 */

import type { Job } from "bullmq";
import type { OcrJobData } from "@/lib/ocr/types";
import { prisma } from "@/lib/db";
import { getFileStream, uploadFile } from "@/lib/storage";
import { ocrPdf, convertToPdf, convertImageToPdf } from "@/lib/ocr/stirling-client";
import { indexDokument } from "@/lib/meilisearch";
import { embeddingQueue } from "@/lib/queue/queues";
import { createLogger } from "@/lib/logger";

const log = createLogger("ocr-processor");

// MIME types that are PDFs
const PDF_MIME = "application/pdf";

// MIME types that are images
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
]);

// MIME types that are office documents (convertible to PDF)
const OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
]);

// MIME types that are plain text (no OCR needed)
const TEXT_MIMES = new Set([
  "text/plain",
  "text/csv",
  "text/html",
  "text/markdown",
  "application/json",
]);

/**
 * Convert a readable stream (from S3) to a Buffer.
 * Handles AWS SDK SdkStreamMixin, Web ReadableStream, and Node.js Readable.
 */
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) throw new Error("No stream data received from storage");

  // Handle AWS SDK SdkStreamMixin (has transformToByteArray)
  if (typeof (stream as any).transformToByteArray === "function") {
    const bytes = await (stream as any).transformToByteArray();
    return Buffer.from(bytes);
  }

  // Handle Blob (from newer AWS SDK versions)
  if (stream instanceof Blob) {
    const arrayBuffer = await stream.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Handle Web ReadableStream
  if (typeof (stream as any).getReader === "function") {
    const reader = (stream as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  }

  // Handle Node.js Readable
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Process an OCR job for a single document.
 */
export async function processOcrJob(job: Job<OcrJobData>): Promise<void> {
  const { dokumentId, akteId, storagePath, mimeType, fileName } = job.data;

  log.info(
    { dokumentId, mimeType, fileName, attempt: job.attemptsMade + 1 },
    "Starting OCR processing"
  );

  // Mark as in progress
  await prisma.dokument.update({
    where: { id: dokumentId },
    data: {
      ocrStatus: "IN_BEARBEITUNG",
      ocrVersuche: { increment: 1 },
    },
  });

  try {
    let extractedText = "";

    if (TEXT_MIMES.has(mimeType)) {
      // Plain text files: read directly, no OCR needed
      const stream = await getFileStream(storagePath);
      const buffer = await streamToBuffer(stream);
      extractedText = buffer.toString("utf-8");

      log.info({ dokumentId }, "Text file read directly (no OCR)");
    } else if (mimeType === PDF_MIME) {
      // PDFs: run OCR directly (skip-text mode handles already-searchable PDFs)
      const stream = await getFileStream(storagePath);
      const pdfBuffer = await streamToBuffer(stream);
      const ocrResult = await ocrPdf(pdfBuffer);

      // Upload OCR'd PDF back to MinIO (replace original)
      await uploadFile(storagePath, ocrResult, PDF_MIME, ocrResult.length);

      // Update file size in database (OCR'd PDF may differ from original)
      await prisma.dokument.update({
        where: { id: dokumentId },
        data: { groesse: ocrResult.length },
      });

      // Extract text from OCR'd PDF (use the text layer added by Stirling)
      extractedText = await extractTextFromBuffer(ocrResult);

      log.info({ dokumentId, textLength: extractedText.length }, "PDF OCR completed");
    } else if (IMAGE_MIMES.has(mimeType)) {
      // Images: convert to PDF first, then OCR
      const stream = await getFileStream(storagePath);
      const imageBuffer = await streamToBuffer(stream);
      const pdfFromImage = await convertImageToPdf(imageBuffer, fileName);
      const ocrResult = await ocrPdf(pdfFromImage);

      // Store OCR'd PDF as preview
      const previewPath = `akten/${akteId}/previews/${dokumentId}.pdf`;
      await uploadFile(previewPath, ocrResult, PDF_MIME, ocrResult.length);

      await prisma.dokument.update({
        where: { id: dokumentId },
        data: { previewPfad: previewPath },
      });

      extractedText = await extractTextFromBuffer(ocrResult);

      log.info({ dokumentId, textLength: extractedText.length }, "Image OCR completed");
    } else if (OFFICE_MIMES.has(mimeType)) {
      // Office documents: convert to PDF, then OCR
      const stream = await getFileStream(storagePath);
      const docBuffer = await streamToBuffer(stream);
      const pdfFromDoc = await convertToPdf(docBuffer, fileName);
      const ocrResult = await ocrPdf(pdfFromDoc);

      // Store converted PDF as preview
      const previewPath = `akten/${akteId}/previews/${dokumentId}.pdf`;
      await uploadFile(previewPath, ocrResult, PDF_MIME, ocrResult.length);

      await prisma.dokument.update({
        where: { id: dokumentId },
        data: { previewPfad: previewPath },
      });

      extractedText = await extractTextFromBuffer(ocrResult);

      log.info({ dokumentId, textLength: extractedText.length }, "Office doc OCR completed");
    } else {
      // Unknown type: mark as not needed
      await prisma.dokument.update({
        where: { id: dokumentId },
        data: {
          ocrStatus: "NICHT_NOETIG",
          ocrAbgeschlossen: new Date(),
        },
      });
      log.info({ dokumentId, mimeType }, "Unknown MIME type, skipping OCR");
      return;
    }

    // Update document with OCR results
    const updatedDoc = await prisma.dokument.update({
      where: { id: dokumentId },
      data: {
        ocrStatus: "ABGESCHLOSSEN",
        ocrAbgeschlossen: new Date(),
        ocrFehler: null,
        ocrText: extractedText || null,
      },
      include: {
        akte: { select: { aktenzeichen: true, kurzrubrum: true } },
        createdBy: { select: { name: true } },
      },
    });

    // Re-index in Meilisearch with OCR text
    await indexDokument({
      id: dokumentId,
      akteId,
      name: updatedDoc.name,
      mimeType: updatedDoc.mimeType,
      ordner: updatedDoc.ordner,
      tags: updatedDoc.tags,
      ocrText: extractedText || null,
      createdById: updatedDoc.createdById,
      createdByName: updatedDoc.createdBy.name,
      aktenzeichen: updatedDoc.akte.aktenzeichen,
      kurzrubrum: updatedDoc.akte.kurzrubrum,
      createdAt: Math.floor(new Date(updatedDoc.createdAt).getTime() / 1000),
      ocrStatus: updatedDoc.ocrStatus,
      dokumentStatus: updatedDoc.status,
    }).catch((err) => {
      log.warn({ dokumentId, err }, "Failed to index in Meilisearch (non-fatal)");
    });

    // Chain to embedding queue if we have text
    if (extractedText && extractedText.length > 0) {
      await embeddingQueue.add("embed-document", {
        dokumentId,
        akteId,
        ocrText: extractedText,
      });
      log.info({ dokumentId }, "Embedding job enqueued");
    }
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    log.error({ dokumentId, err: errMessage, attempt: job.attemptsMade + 1 }, "OCR processing failed");

    // Check if this is the final attempt
    const maxAttempts = job.opts.attempts ?? 3;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    await prisma.dokument.update({
      where: { id: dokumentId },
      data: {
        ocrStatus: isFinalAttempt ? "FEHLGESCHLAGEN" : "AUSSTEHEND",
        ocrFehler: errMessage,
      },
    });

    throw err; // Re-throw so BullMQ handles retry/failure
  }
}

/**
 * Extract plain text from a PDF buffer.
 * Uses pdf-parse v2 (PDFParse class) for reliable text extraction.
 */
async function extractTextFromBuffer(pdfBuffer: Buffer): Promise<string> {
  try {
    // pdf-parse v2 exports { PDFParse } class instead of a default function
    const { PDFParse } = require("pdf-parse") as {
      PDFParse: new (opts: { data: Buffer }) => {
        getText: () => Promise<{ text: string }>;
        destroy: () => Promise<void>;
      };
    };
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "pdf-parse failed, using fallback text extraction");
    // Fallback: basic text extraction from PDF binary
    // This is a simplified approach; text between BT/ET markers
    const text = pdfBuffer.toString("latin1");
    const matches: string[] = [];
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const decoded = match[1];
      if (decoded && decoded.length > 2 && /[a-zA-Z\u00C0-\u024F]/.test(decoded)) {
        matches.push(decoded);
      }
    }
    return matches.join(" ").trim();
  }
}
