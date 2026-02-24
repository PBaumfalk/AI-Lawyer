import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/storage";

/**
 * GET /api/dokumente/[id]/preview -- Get a PDF preview URL for the document.
 *
 * - PDF files: returns presigned URL of the original file.
 * - Non-PDF with previewPfad: returns presigned URL for the generated PDF preview.
 * - Non-PDF without previewPfad: returns 202 (preview still generating).
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
    select: {
      id: true,
      dateipfad: true,
      mimeType: true,
      previewPfad: true,
    },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // PDF files -- serve the original
  if (dokument.mimeType === "application/pdf") {
    try {
      const url = await getDownloadUrl(dokument.dateipfad);
      return NextResponse.json({ url, status: "ready" });
    } catch {
      return NextResponse.json(
        { error: "Datei konnte nicht geladen werden" },
        { status: 500 }
      );
    }
  }

  // Non-PDF with a generated preview
  if (dokument.previewPfad) {
    try {
      const url = await getDownloadUrl(dokument.previewPfad);
      return NextResponse.json({ url, status: "ready" });
    } catch {
      return NextResponse.json(
        { error: "Preview konnte nicht geladen werden" },
        { status: 500 }
      );
    }
  }

  // Non-PDF without preview yet -- still generating
  return NextResponse.json(
    { url: null, status: "generating" },
    { status: 202 }
  );
}
