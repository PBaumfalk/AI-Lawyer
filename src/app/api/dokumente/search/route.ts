import { NextRequest, NextResponse } from "next/server";
import { searchDokumente } from "@/lib/meilisearch";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/dokumente/search -- full-text search across all documents via Meilisearch
 * Query params: q, akteId, ordner, mimeType, limit, offset
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const akteId = searchParams.get("akteId") ?? undefined;
  const ordner = searchParams.get("ordner") ?? undefined;
  const mimeType = searchParams.get("mimeType") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    const results = await searchDokumente(q, {
      akteId,
      ordner,
      mimeType,
      limit,
      offset,
    });

    return NextResponse.json({
      hits: results.hits,
      totalHits: results.estimatedTotalHits,
      query: results.query,
      processingTimeMs: results.processingTimeMs,
    });
  } catch (err: any) {
    // If Meilisearch is not available, return empty results
    console.error("[Search API] Meilisearch error:", err.message);
    return NextResponse.json({
      hits: [],
      totalHits: 0,
      query: q,
      processingTimeMs: 0,
      error: "Volltextsuche nicht verfuegbar",
    });
  }
}
