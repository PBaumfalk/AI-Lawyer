/**
 * Meilisearch client for full-text document search.
 * Indexes document metadata + OCR text for fast search across all case files.
 */

import { MeiliSearch } from "meilisearch";

const MEILISEARCH_URL = process.env.MEILISEARCH_URL ?? "http://localhost:7700";
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY ?? "ailawyer-meili-key";

export const meiliClient = new MeiliSearch({
  host: MEILISEARCH_URL,
  apiKey: MEILISEARCH_API_KEY,
});

export const DOKUMENTE_INDEX = "dokumente";

export interface DokumentSearchRecord {
  id: string;
  akteId: string;
  name: string;
  mimeType: string;
  ordner: string | null;
  tags: string[];
  ocrText: string | null;
  createdById: string;
  createdByName: string;
  aktenzeichen: string;
  kurzrubrum: string;
  createdAt: number; // Unix timestamp for sorting
  ocrStatus?: string;
  dokumentStatus?: string;
}

/**
 * Ensure the dokumente index exists with correct settings.
 */
export async function ensureDokumenteIndex(): Promise<void> {
  try {
    await meiliClient.getIndex(DOKUMENTE_INDEX);
  } catch {
    await meiliClient.createIndex(DOKUMENTE_INDEX, { primaryKey: "id" });
  }

  const index = meiliClient.index(DOKUMENTE_INDEX);

  await index.updateSettings({
    searchableAttributes: ["name", "ocrText", "tags", "aktenzeichen", "kurzrubrum", "ordner", "createdByName"],
    filterableAttributes: [
      "akteId", "mimeType", "ordner", "tags", "createdById",
      "ocrStatus", "dokumentStatus", "createdAt",
    ],
    sortableAttributes: ["createdAt", "name"],
    displayedAttributes: [
      "id", "akteId", "name", "mimeType", "ordner", "tags",
      "createdById", "createdByName", "aktenzeichen", "kurzrubrum", "createdAt",
      "ocrStatus", "dokumentStatus", "ocrText",
    ],
    rankingRules: [
      "words", "typo", "proximity", "attribute", "sort", "exactness",
    ],
  });
}

/**
 * Index a single document in Meilisearch.
 */
export async function indexDokument(doc: DokumentSearchRecord): Promise<void> {
  try {
    const index = meiliClient.index(DOKUMENTE_INDEX);
    await index.addDocuments([doc]);
  } catch (err) {
    console.error("[Meilisearch] Failed to index document:", err);
  }
}

/**
 * Remove a document from the Meilisearch index.
 */
export async function removeDokumentFromIndex(docId: string): Promise<void> {
  try {
    const index = meiliClient.index(DOKUMENTE_INDEX);
    await index.deleteDocument(docId);
  } catch (err) {
    console.error("[Meilisearch] Failed to remove document:", err);
  }
}

/**
 * Search documents with optional filters for akteId, folder, MIME type,
 * OCR status, document status, date range, and more.
 */
export async function searchDokumente(
  query: string,
  options?: {
    akteId?: string;
    ordner?: string;
    mimeType?: string;
    tags?: string[];
    ocrStatus?: string;
    dokumentStatus?: string;
    createdById?: string;
    dateFrom?: number; // Unix timestamp
    dateTo?: number;   // Unix timestamp
    limit?: number;
    offset?: number;
  }
) {
  const index = meiliClient.index(DOKUMENTE_INDEX);

  const filter: string[] = [];
  if (options?.akteId) filter.push(`akteId = "${options.akteId}"`);
  if (options?.ordner) filter.push(`ordner = "${options.ordner}"`);
  if (options?.mimeType) filter.push(`mimeType = "${options.mimeType}"`);
  if (options?.ocrStatus) filter.push(`ocrStatus = "${options.ocrStatus}"`);
  if (options?.dokumentStatus) filter.push(`dokumentStatus = "${options.dokumentStatus}"`);
  if (options?.createdById) filter.push(`createdById = "${options.createdById}"`);
  if (options?.tags && options.tags.length > 0) {
    filter.push(`tags IN [${options.tags.map((t) => `"${t}"`).join(", ")}]`);
  }
  if (options?.dateFrom) filter.push(`createdAt >= ${options.dateFrom}`);
  if (options?.dateTo) filter.push(`createdAt <= ${options.dateTo}`);

  return index.search(query, {
    filter: filter.length > 0 ? filter : undefined,
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
    sort: ["createdAt:desc"],
    attributesToHighlight: ["ocrText", "name"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
    attributesToCrop: ["ocrText"],
    cropLength: 200,
    showRankingScore: true,
  });
}
