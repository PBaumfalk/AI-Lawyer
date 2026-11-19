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

/** Index settings for "dokumente" (shared by ensureDokumenteIndex and the full reindex). */
export const DOKUMENTE_INDEX_SETTINGS = {
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
};

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

  await index.updateSettings(DOKUMENTE_INDEX_SETTINGS);
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
export interface DokumentSearchOptions {
  akteId?: string;
  /** Restrict hits to these Akten (access control). Undefined = no restriction. */
  akteIds?: string[];
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

/**
 * Quote a value for a Meilisearch filter expression. Values come from URL
 * parameters; unescaped quotes would let a caller rewrite the filter (and
 * thereby drop the access restriction).
 */
export function meiliString(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildDokumentFilter(options: DokumentSearchOptions = {}): string[] {
  const filter: string[] = [];
  if (options.akteIds) filter.push(`akteId IN [${options.akteIds.map(meiliString).join(", ")}]`);
  if (options.akteId) filter.push(`akteId = ${meiliString(options.akteId)}`);
  if (options.ordner) filter.push(`ordner = ${meiliString(options.ordner)}`);
  if (options.mimeType) filter.push(`mimeType = ${meiliString(options.mimeType)}`);
  if (options.ocrStatus) filter.push(`ocrStatus = ${meiliString(options.ocrStatus)}`);
  if (options.dokumentStatus) filter.push(`dokumentStatus = ${meiliString(options.dokumentStatus)}`);
  if (options.createdById) filter.push(`createdById = ${meiliString(options.createdById)}`);
  if (options.tags && options.tags.length > 0) {
    filter.push(`tags IN [${options.tags.map(meiliString).join(", ")}]`);
  }
  if (Number.isFinite(options.dateFrom)) filter.push(`createdAt >= ${Math.floor(options.dateFrom!)}`);
  if (Number.isFinite(options.dateTo)) filter.push(`createdAt <= ${Math.floor(options.dateTo!)}`);
  return filter;
}

export async function searchDokumente(query: string, options?: DokumentSearchOptions) {
  const index = meiliClient.index(DOKUMENTE_INDEX);
  const filter = buildDokumentFilter(options);

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
