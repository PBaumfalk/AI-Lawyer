/**
 * MinIO/S3-compatible object storage client.
 * Uses @aws-sdk/client-s3 for compatibility.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "localhost";
const MINIO_PORT = process.env.MINIO_PORT ?? "9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "ailawyer";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "ailawyer123";
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "dokumente";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
// Public URL for presigned URLs (browser-accessible), falls back to internal endpoint
const MINIO_PUBLIC_URL =
  process.env.MINIO_PUBLIC_URL ??
  `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}:${MINIO_PORT}`;

const protocol = MINIO_USE_SSL ? "https" : "http";

// Internal S3 client for server-side operations (uploads, downloads, deletes)
export const s3Client = new S3Client({
  endpoint: `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  region: "us-east-1", // MinIO ignores this but SDK requires it
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

// Public S3 client for generating presigned URLs reachable from the browser
const publicS3Client = new S3Client({
  endpoint: MINIO_PUBLIC_URL,
  region: "us-east-1",
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const BUCKET = MINIO_BUCKET;

/**
 * Ensure the bucket exists, creating it if necessary.
 */
export async function ensureBucket(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/**
 * Upload a file to MinIO.
 * @returns The storage key (path) of the uploaded file.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string,
  size: number
): Promise<string> {
  await ensureBucket();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: size,
    })
  );

  return key;
}

/**
 * Get a pre-signed download URL (valid for 1 hour).
 */
export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  // Use publicS3Client so the presigned URL points to the browser-reachable MinIO endpoint
  return getSignedUrl(publicS3Client, command, { expiresIn: 3600 });
}

/**
 * Get a file's content as a readable stream.
 */
export async function getFileStream(key: string) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  return response.Body;
}

/**
 * Delete a file from MinIO.
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Generate a storage key for a document.
 * Format: akten/{akteId}/dokumente/{timestamp}_{sanitizedName}
 */
export function generateStorageKey(
  akteId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return `akten/${akteId}/dokumente/${timestamp}_${sanitized}`;
}
