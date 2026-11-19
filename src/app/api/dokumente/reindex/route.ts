import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { meiliClient } from "@/lib/meilisearch";
import { prismaSeitenLader, reindexDokumente } from "@/lib/search/reindex";
import { requireRole } from "@/lib/rbac";

/**
 * POST /api/dokumente/reindex -- rebuild the Meilisearch index from the database
 * Admin-only. Same logic as the CLI that scripts/restore.sh runs
 * (node dist-worker/reindex-suche.mjs).
 */
export async function POST(_request: NextRequest) {
  // RBAC: admin only
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  try {
    const { indexiert } = await reindexDokumente({
      client: meiliClient,
      ladeSeite: prismaSeitenLader(prisma),
    });

    return NextResponse.json({
      success: true,
      indexed: indexiert,
      message: `${indexiert} Dokument${indexiert !== 1 ? "e" : ""} indexiert`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Indexierung fehlgeschlagen: ${err.message}` },
      { status: 500 }
    );
  }
}
