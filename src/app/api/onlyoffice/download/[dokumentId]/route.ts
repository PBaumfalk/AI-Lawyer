import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileStream } from "@/lib/storage";
import { verifyToken } from "@/lib/onlyoffice";

/**
 * GET /api/onlyoffice/download/[dokumentId] — serves document content to ONLYOFFICE DocumentServer.
 *
 * This endpoint is called by ONLYOFFICE (from Docker) to fetch the document.
 * When JWT is enabled, ONLYOFFICE sends an Authorization header with its requests.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dokumentId: string }> }
) {
  const { dokumentId } = await params;

  // Verify JWT from ONLYOFFICE if present
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      verifyToken(authHeader.substring(7));
    } catch (err) {
      console.error("[ONLYOFFICE] Download JWT verification failed:", err);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }
  console.log(`[ONLYOFFICE] Download request for document: ${dokumentId}`);

  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  try {
    const stream = await getFileStream(dokument.dateipfad);
    if (!stream) {
      return NextResponse.json(
        { error: "Datei nicht im Speicher gefunden" },
        { status: 404 }
      );
    }

    const webStream = stream.transformToWebStream();

    return new NextResponse(webStream as any, {
      headers: {
        "Content-Type": dokument.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(dokument.name)}"`,
        "Content-Length": String(dokument.groesse),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Datei konnte nicht geladen werden" },
      { status: 500 }
    );
  }
}
