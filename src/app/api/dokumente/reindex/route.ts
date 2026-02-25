import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDokumenteIndex, indexDokument } from "@/lib/meilisearch";
import { requireRole } from "@/lib/rbac";

/**
 * POST /api/dokumente/reindex -- reindex all documents in Meilisearch
 * Admin-only: rebuilds the full-text search index
 */
export async function POST(_request: NextRequest) {
  // RBAC: admin only
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  try {
    await ensureDokumenteIndex();

    const dokumente = await prisma.dokument.findMany({
      include: {
        akte: { select: { aktenzeichen: true, kurzrubrum: true } },
        createdBy: { select: { name: true } },
      },
    });

    let indexed = 0;
    for (const doc of dokumente) {
      await indexDokument({
        id: doc.id,
        akteId: doc.akteId,
        name: doc.name,
        mimeType: doc.mimeType,
        ordner: doc.ordner,
        tags: doc.tags,
        ocrText: doc.ocrText,
        createdById: doc.createdById,
        createdByName: doc.createdBy.name,
        aktenzeichen: doc.akte.aktenzeichen,
        kurzrubrum: doc.akte.kurzrubrum,
        createdAt: Math.floor(new Date(doc.createdAt).getTime() / 1000),
      });
      indexed++;
    }

    return NextResponse.json({
      success: true,
      indexed,
      message: `${indexed} Dokument${indexed !== 1 ? "e" : ""} indexiert`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Indexierung fehlgeschlagen: ${err.message}` },
      { status: 500 }
    );
  }
}
