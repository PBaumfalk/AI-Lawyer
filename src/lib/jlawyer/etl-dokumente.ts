import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { indexDokument } from "@/lib/meilisearch";
import { ocrQueue } from "@/lib/queue/queues";
import type { OcrJobData } from "@/lib/ocr/types";
import type { JLawyerClient } from "./client";
import type { JLawyerCaseFolder, JLawyerMigrationStats } from "./types";

/** j-lawyer delivers no MIME type — derive it from the file extension. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  md: "text/markdown",
  json: "application/json",
  xml: "application/xml",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
  zip: "application/zip",
};

export function mimeTypeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Same rule as the regular upload route: text files need no OCR. */
const TEXT_MIMES = new Set(["text/plain", "text/csv", "text/html", "text/markdown", "application/json"]);

/** Flatten the j-lawyer folder tree into folderId → "Parent/Child" path. */
export function flattenFolders(root: JLawyerCaseFolder | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (f: JLawyerCaseFolder, prefix: string | null, isRoot: boolean) => {
    // The root node is the case itself; its name is not a real sub-folder.
    const path = isRoot ? null : [prefix, f.name?.trim()].filter(Boolean).join("/") || null;
    if (!isRoot && path) map.set(f.id, path);
    for (const c of f.children ?? []) walk(c, path, false);
  };
  if (root?.id) walk(root, null, true);
  return map;
}

type Stats = Pick<JLawyerMigrationStats, "dokumente" | "errors" | "hinweise">;

/**
 * Migrates j-lawyer case documents into MinIO + Dokument records and hands
 * them to the regular document pipeline (Meilisearch index + OCR queue), so
 * migrated documents become searchable and usable for Helena/RAG just like
 * uploaded ones.
 *
 * Status stays ENTWURF (the schema default, identical to a regular upload).
 * Re-run rule: documents already carrying the jlawyerId are skipped.
 */
export async function migrateDokumente(
  client: JLawyerClient,
  aktenMap: Map<string, string>, // jlCaseId → Akte.id
  importUser: { id: string; name: string },
): Promise<Stats> {
  const stats: Stats = { dokumente: 0, errors: [], hinweise: [] };

  for (const [jlCaseId, akteId] of Array.from(aktenMap.entries())) {
    let documents;
    try {
      documents = await client.getCaseDocuments(jlCaseId);
    } catch (e) {
      stats.errors.push({ entity: "Dokumente-Liste", id: jlCaseId, message: (e as Error).message });
      continue;
    }
    if (documents.length === 0) continue;

    let folders = new Map<string, string>();
    try {
      folders = flattenFolders(await client.getCaseFolders(jlCaseId));
    } catch (e) {
      stats.hinweise.push({
        entity: "Dokumente-Ordner",
        id: jlCaseId,
        message: `Ordnerstruktur nicht lesbar (${(e as Error).message}); Dokumente ohne Ordner übernommen.`,
      });
    }

    const akte = await prisma.akte.findUniqueOrThrow({
      where: { id: akteId },
      select: { aktenzeichen: true, kurzrubrum: true },
    });

    for (const doc of documents) {
      try {
        const existing = await prisma.dokument.findFirst({
          where: { jlawyerId: doc.id },
          select: { id: true },
        });
        if (existing) continue;

        const { buffer } = await client.getDocumentContent(doc.id);
        const mimeType = mimeTypeFromName(doc.name);
        const safeName = doc.name.replace(/[^a-zA-Z0-9._\-äöüÄÖÜß ]/g, "_");
        const storageKey = `akten/${akteId}/jlawyer/${doc.id}_${safeName}`;
        await uploadFile(storageKey, buffer, mimeType, buffer.byteLength);

        const needsOcr = !TEXT_MIMES.has(mimeType);
        const ocrText = needsOcr ? null : buffer.toString("utf-8");

        const dokument = await prisma.dokument.create({
          data: {
            akteId,
            name: doc.name,
            dateipfad: storageKey,
            mimeType,
            groesse: buffer.byteLength,
            version: doc.version && doc.version > 0 ? doc.version : 1,
            ordner: (doc.folderId && folders.get(doc.folderId)) || null,
            erstelltDurch: "jlawyer",
            createdById: importUser.id,
            jlawyerId: doc.id,
            ocrStatus: needsOcr ? "AUSSTEHEND" : "NICHT_NOETIG",
            ocrText,
            ocrAbgeschlossen: needsOcr ? null : new Date(),
          },
        });

        await indexDokument({
          id: dokument.id,
          akteId,
          name: dokument.name,
          mimeType,
          ordner: dokument.ordner,
          tags: dokument.tags,
          ocrText,
          createdById: importUser.id,
          createdByName: importUser.name,
          aktenzeichen: akte.aktenzeichen,
          kurzrubrum: akte.kurzrubrum,
          createdAt: Math.floor(dokument.createdAt.getTime() / 1000),
          ocrStatus: dokument.ocrStatus,
          dokumentStatus: dokument.status,
        });

        if (needsOcr) {
          const job: OcrJobData = {
            dokumentId: dokument.id,
            akteId,
            storagePath: storageKey,
            mimeType,
            fileName: doc.name,
          };
          try {
            await ocrQueue.add("ocr-document", job);
          } catch (e) {
            // Document is stored; the worker's recovery only retries
            // FEHLGESCHLAGEN, so mark it and report instead of losing it.
            await prisma.dokument.update({
              where: { id: dokument.id },
              data: { ocrStatus: "FEHLGESCHLAGEN", ocrFehler: `OCR-Warteschlange nicht erreichbar: ${(e as Error).message}` },
            });
            stats.hinweise.push({
              entity: "Dokument",
              id: doc.id,
              message: `Übernommen, OCR-Auftrag konnte nicht eingereiht werden (${(e as Error).message}).`,
            });
          }
        }

        stats.dokumente++;
      } catch (e) {
        stats.errors.push({
          entity: "Dokument",
          id: doc.id,
          message: (e as Error).message,
        });
      }
    }
  }

  return stats;
}
