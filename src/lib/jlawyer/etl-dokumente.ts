import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/storage";
import { prisma } from "@/lib/db";
import type { JLawyerClient } from "./client";
import type { JLawyerMigrationStats } from "./types";

const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "dokumente";

export async function migrateDokumente(
  client: JLawyerClient,
  aktenMap: Map<string, string>,   // jlCaseId → Akte.id
  systemUserId: string,
): Promise<Partial<JLawyerMigrationStats>> {
  const stats = { dokumente: 0, errors: [] as JLawyerMigrationStats["errors"] };

  for (const [jlCaseId, akteId] of Array.from(aktenMap.entries())) {
    let documents;
    try {
      documents = await client.getCaseDocuments(jlCaseId);
    } catch (e) {
      stats.errors.push({ entity: "dokumente-list", id: jlCaseId, message: (e as Error).message });
      continue;
    }

    for (const doc of documents) {
      try {
        // Idempotency: skip if already migrated
        const existing = await prisma.dokument.findFirst({
          where: { jlawyerId: doc.id },
          select: { id: true },
        });
        if (existing) {
          stats.dokumente++;
          continue;
        }

        // Download binary from J-Lawyer
        const binary = await client.downloadDocument(jlCaseId, doc.id);

        // Upload to MinIO
        const safeName = doc.name.replace(/[^a-zA-Z0-9._\-äöüÄÖÜß ]/g, "_");
        const minioPath = `akten/${akteId}/jlawyer/${doc.id}_${safeName}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: minioPath,
          Body: Buffer.from(binary),
          ContentType: doc.mimeType || "application/octet-stream",
        }));

        // Create DB record
        await prisma.dokument.create({
          data: {
            akteId,
            name: doc.name,
            dateipfad: minioPath,
            mimeType: doc.mimeType || "application/octet-stream",
            groesse: doc.size || binary.byteLength,
            ordner: doc.folder || null,
            status: "ENTWURF",
            erstelltDurch: "jlawyer",
            createdById: systemUserId,
            jlawyerId: doc.id,
          },
        });

        stats.dokumente++;
      } catch (e) {
        stats.errors.push({
          entity: "dokument",
          id: doc.id,
          message: (e as Error).message,
        });
      }
    }
  }

  return stats;
}
