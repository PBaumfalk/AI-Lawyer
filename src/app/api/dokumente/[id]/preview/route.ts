import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/dokumente/[id]/preview -- Get a PDF preview URL for the document.
 *
 * Returns proxy URLs (Next.js streams from MinIO internally).
 * Browser never talks to MinIO directly.
 *
 * - PDF files: returns /api/dokumente/[id]?inline=true
 * - Non-PDF with previewPfad: returns /api/dokumente/[id]?preview=true
 * - Non-PDF without previewPfad: returns 202 (preview still generating)
 */
export async function GET(
  _request: NextRequest,
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

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    select: { id: true, mimeType: true, previewPfad: true },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // PDF files -- proxy through Next.js inline
  if (dokument.mimeType === "application/pdf") {
    return NextResponse.json({
      url: `/api/dokumente/${id}?inline=true`,
      status: "ready",
    });
  }

  // Non-PDF with a generated preview -- proxy preview PDF inline
  if (dokument.previewPfad) {
    return NextResponse.json({
      url: `/api/dokumente/${id}?preview=true`,
      status: "ready",
    });
  }

  // Non-PDF without preview yet -- still generating
  return NextResponse.json(
    { url: null, status: "generating" },
    { status: 202 }
  );
}
