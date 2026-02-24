import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { indexDokument } from "@/lib/meilisearch";

/**
 * PUT /api/dokumente/[id]/tags -- Update the tags for a document.
 * Body: { tags: string[] }
 *
 * Replaces the document's tags array and re-indexes in Meilisearch.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: { tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.tags)) {
    return NextResponse.json(
      { error: "tags muss ein Array von Strings sein" },
      { status: 400 }
    );
  }

  // Validate each tag is a non-empty string
  const tags = body.tags
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim());

  // Remove duplicates
  const uniqueTags = Array.from(new Set(tags));

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  const updated = await prisma.dokument.update({
    where: { id },
    data: { tags: uniqueTags },
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
      createdBy: { select: { name: true } },
    },
  });

  // Re-index in Meilisearch (non-blocking)
  indexDokument({
    id: updated.id,
    akteId: updated.akteId,
    name: updated.name,
    mimeType: updated.mimeType,
    ordner: updated.ordner,
    tags: updated.tags,
    ocrText: updated.ocrText,
    createdById: updated.createdById,
    createdByName: updated.createdBy.name,
    aktenzeichen: updated.akte.aktenzeichen,
    kurzrubrum: updated.akte.kurzrubrum,
    createdAt: Math.floor(new Date(updated.createdAt).getTime() / 1000),
  }).catch(() => {});

  return NextResponse.json({
    id: updated.id,
    tags: updated.tags,
  });
}
