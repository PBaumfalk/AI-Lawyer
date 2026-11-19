import { NextRequest, NextResponse } from "next/server";
import { searchDokumenteForUser, intParam } from "@/lib/search/dokumente";
import { requireAuth } from "@/lib/rbac";

/**
 * SearchResult shape returned to the client.
 * Enriched with highlighted name/snippet and case info.
 */
export interface SearchResult {
  id: string;
  name: string;
  akteId: string;
  aktenzeichen: string;
  kurzrubrum: string;
  mimeType: string;
  ocrStatus: string | null;
  dokumentStatus: string | null;
  tags: string[];
  createdByName: string;
  createdAt: number;
  /** Highlighted + cropped OCR text snippet */
  snippet: string | null;
  /** Document name with search term highlighted */
  nameHighlighted: string;
  /** Meilisearch ranking score (0-1) */
  score: number | null;
}

/**
 * GET /api/search -- enhanced full-text document search with all filters.
 *
 * Query params:
 *   q            - search query (required)
 *   akteId       - filter by case
 *   mimeType     - filter by MIME type
 *   tags         - comma-separated tag names
 *   ocrStatus    - filter by OCR status
 *   dokumentStatus - filter by document status
 *   createdById  - filter by uploader
 *   dateFrom     - ISO date string (start of range)
 *   dateTo       - ISO date string (end of range)
 *   limit        - max results (default 20, max 100)
 *   offset       - pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const akteId = searchParams.get("akteId") ?? undefined;
  const mimeType = searchParams.get("mimeType") ?? undefined;
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;
  const ocrStatus = searchParams.get("ocrStatus") ?? undefined;
  const dokumentStatus = searchParams.get("dokumentStatus") ?? undefined;
  const createdById = searchParams.get("createdById") ?? undefined;
  const dateFromStr = searchParams.get("dateFrom");
  const dateToStr = searchParams.get("dateTo");

  const toUnix = (s: string | null) => {
    if (!s) return undefined;
    const ms = new Date(s).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
  };
  const dateFrom = toUnix(dateFromStr);
  // "Bis" is inclusive: a plain date (YYYY-MM-DD) covers the whole day.
  const dateTo =
    dateToStr && /^\d{4}-\d{2}-\d{2}$/.test(dateToStr)
      ? toUnix(`${dateToStr}T23:59:59.999`)
      : toUnix(dateToStr);

  const limit = intParam(searchParams.get("limit"), 20, 1, 100);
  const offset = intParam(searchParams.get("offset"), 0, 0, 10_000);
  const user = { id: result.session.user.id, role: result.session.user.role };

  try {
    const results = await searchDokumenteForUser(user, q, {
      akteId,
      mimeType,
      tags,
      ocrStatus,
      dokumentStatus,
      createdById,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    // Transform hits into SearchResult shape with highlighted snippets
    const hits: SearchResult[] = results.hits.map((hit: Record<string, unknown>) => {
      const formatted = hit._formatted as Record<string, unknown> | undefined;

      return {
        id: hit.id as string,
        name: hit.name as string,
        akteId: hit.akteId as string,
        aktenzeichen: (hit.aktenzeichen as string) ?? "",
        kurzrubrum: (hit.kurzrubrum as string) ?? "",
        mimeType: (hit.mimeType as string) ?? "",
        ocrStatus: (hit.ocrStatus as string) ?? null,
        dokumentStatus: (hit.dokumentStatus as string) ?? null,
        tags: (hit.tags as string[]) ?? [],
        createdByName: (hit.createdByName as string) ?? "",
        createdAt: hit.createdAt as number,
        snippet: (formatted?.ocrText as string) ?? null,
        nameHighlighted: (formatted?.name as string) ?? (hit.name as string),
        score: (hit._rankingScore as number) ?? null,
      };
    });

    return NextResponse.json({
      hits,
      estimatedTotalHits: results.estimatedTotalHits ?? 0,
      processingTimeMs: results.processingTimeMs ?? 0,
      query: results.query,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[Search API] Meilisearch error:", message);
    return NextResponse.json({
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 0,
      query: q,
      error: "Volltextsuche nicht verfügbar",
    });
  }
}
