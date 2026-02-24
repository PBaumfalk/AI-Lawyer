/**
 * Preview processor.
 * Generates PDF previews for non-PDF documents via Stirling-PDF.
 */

import type { Job } from "bullmq";
import type { PreviewJobData } from "@/lib/ocr/types";
import { prisma } from "@/lib/db";
import { getFileStream, uploadFile } from "@/lib/storage";
import { convertToPdf, convertImageToPdf } from "@/lib/ocr/stirling-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("preview-processor");

const PDF_MIME = "application/pdf";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
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

  // Handle Blob
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
 * Process a preview generation job for a non-PDF document.
 */
export async function processPreviewJob(job: Job<PreviewJobData>): Promise<void> {
  const { dokumentId, storagePath, mimeType, fileName, akteId } = job.data;

  // Skip PDFs -- they are their own preview
  if (mimeType === PDF_MIME) {
    log.info({ dokumentId }, "PDF file, no preview generation needed");
    return;
  }

  log.info({ dokumentId, mimeType, fileName }, "Generating PDF preview");

  try {
    const stream = await getFileStream(storagePath);
    const fileBuffer = await streamToBuffer(stream);

    let pdfBuffer: Buffer;

    if (IMAGE_MIMES.has(mimeType)) {
      pdfBuffer = await convertImageToPdf(fileBuffer, fileName);
    } else {
      pdfBuffer = await convertToPdf(fileBuffer, fileName);
    }

    // Store preview in MinIO
    const previewPath = `akten/${akteId}/previews/${dokumentId}.pdf`;
    await uploadFile(previewPath, pdfBuffer, PDF_MIME, pdfBuffer.length);

    // Update document record
    await prisma.dokument.update({
      where: { id: dokumentId },
      data: { previewPfad: previewPath },
    });

    log.info({ dokumentId, previewPath }, "PDF preview generated successfully");
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    log.error({ dokumentId, err: errMessage }, "Preview generation failed");
    throw err; // Re-throw for BullMQ retry
  }
}
