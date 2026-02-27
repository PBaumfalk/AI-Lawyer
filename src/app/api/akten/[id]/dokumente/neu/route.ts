import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile, getFileStream } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { indexDokument } from "@/lib/meilisearch";
import { createBlankDocx } from "@/lib/vorlagen";
import { applyBriefkopfToDocx } from "@/lib/briefkopf";
import { requireAkteAccess } from "@/lib/rbac";

/**
 * POST /api/akten/[id]/dokumente/neu -- create a new blank DOCX document
 * Body JSON:
 *   - dateiname: Desired filename (optional, defaults to "Neues Dokument.docx")
 *   - ordner: Optional folder to place the document in
 *   - tags: Optional array of tags
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access with edit permission
  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;
  const userId = session.user.id;

  // Verify case exists
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    select: { id: true, aktenzeichen: true, kurzrubrum: true },
  });
  if (!akte) {
    return NextResponse.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rawName = (body.dateiname as string)?.trim() || "Neues Dokument";
  const dateiname = rawName.endsWith(".docx") ? rawName : rawName + ".docx";
  const ordner = (body.ordner as string) || null;
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];

  try {
    // Generate blank DOCX
    let blankBuffer: Buffer = createBlankDocx();

    // Apply default Briefkopf if available
    const briefkopf = await prisma.briefkopf.findFirst({
      where: { istStandard: true },
    });

    if (briefkopf?.dateipfad) {
      try {
        const bkStream = await getFileStream(briefkopf.dateipfad);
        if (bkStream) {
          const bkChunks: Uint8Array[] = [];
          for await (const chunk of bkStream as AsyncIterable<Uint8Array>) {
            bkChunks.push(chunk);
          }
          const briefkopfBuffer = Buffer.concat(bkChunks);
          blankBuffer = applyBriefkopfToDocx(blankBuffer, briefkopfBuffer);
        }
      } catch (err) {
        console.error("[NeuDokument] Briefkopf apply failed:", err);
        // Continue without Briefkopf rather than failing
      }
    }

    // Upload to MinIO
    const timestamp = Date.now();
    const sanitized = dateiname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const storageKey = `akten/${akteId}/dokumente/${timestamp}_${sanitized}`;

    await uploadFile(
      storageKey,
      blankBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      blankBuffer.length
    );

    // Create document record
    const dokument = await prisma.dokument.create({
      data: {
        akteId,
        name: dateiname,
        dateipfad: storageKey,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        groesse: blankBuffer.length,
        ordner,
        tags,
        createdById: userId,
      },
    });

    // Audit log
    await logAuditEvent({
      userId,
      akteId,
      aktion: "DOKUMENT_HOCHGELADEN",
      details: {
        name: dateiname,
        neuesDokument: true,
      },
    });

    // Index in Meilisearch (non-blocking)
    indexDokument({
      id: dokument.id,
      akteId,
      name: dateiname,
      mimeType: dokument.mimeType,
      ordner: dokument.ordner,
      tags: dokument.tags,
      ocrText: null,
      createdById: userId,
      createdByName: session.user.name ?? "",
      aktenzeichen: akte.aktenzeichen,
      kurzrubrum: akte.kurzrubrum,
      createdAt: Math.floor(new Date(dokument.createdAt).getTime() / 1000),
    }).catch(() => {});

    return NextResponse.json({ dokument }, { status: 201 });
  } catch (err: any) {
    console.error("Blank document creation error:", err);
    return NextResponse.json(
      {
        error:
          err.message?.slice(0, 200) ??
          "Fehler beim Erstellen des neuen Dokuments",
      },
      { status: 500 }
    );
  }
}
