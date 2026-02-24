/**
 * Type definitions for the OCR and document processing pipeline.
 */

/** Data payload for OCR processing jobs */
export interface OcrJobData {
  dokumentId: string;
  akteId: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
}

/** Data payload for embedding generation jobs */
export interface EmbeddingJobData {
  dokumentId: string;
  akteId: string;
  ocrText: string;
}

/** Data payload for PDF preview generation jobs */
export interface PreviewJobData {
  dokumentId: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
  akteId: string;
}
