import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileStream, uploadFile, generateStorageKey } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import { mergePdfs } from "@/lib/pdf/stirling-pdf-tools";

// ─── Request body type ───────────────────────────────────────────────────────

interface MergeRequest {
  dokumentIds: string[];
  akteId: string;
  name?: string;
}

/**
 * POST /api/dokumente/pdf-tools/merge
 *
 * Merge multiple PDF documents into a single document.
 * All source documents must belong to the same Akte.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  // Parse request body
  let body: MergeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger JSON-Body" },
      { status: 400 }
    );
  }

  // Validate input
  if (!body.dokumentIds || !Array.isArray(body.dokumentIds) || body.dokumentIds.length < 2) {
    return NextResponse.json(
      { error: "Mindestens 2 Dokument-IDs muessen angegeben werden" },
      { status: 400 }
    );
  }

  if (!body.akteId) {
    return NextResponse.json(
      { error: "Akten-ID (akteId) muss angegeben werden" },
      { status: 400 }
    );
  }

  // RBAC: check access to the Akte
  const access = await requireAkteAccess(body.akteId);
  if (access.error) return access.error;

  // Fetch all documents in a single query
  const dokumente = await prisma.dokument.findMany({
    where: {
      id: { in: body.dokumentIds },
      akteId: body.akteId,
    },
    select: {
      id: true,
      name: true,
      dateipfad: true,
      mimeType: true,
    },
  });

  // Validate all documents found and belong to Akte
  if (dokumente.length !== body.dokumentIds.length) {
    const foundIds = new Set(dokumente.map((d) => d.id));
    const missingIds = body.dokumentIds.filter((id) => !foundIds.has(id));
    return NextResponse.json(
      {
        error: `Dokumente nicht gefunden oder gehoeren nicht zur Akte: ${missingIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate all are PDFs
  const nonPdfs = dokumente.filter((d) => d.mimeType !== "application/pdf");
  if (nonPdfs.length > 0) {
    return NextResponse.json(
      {
        error: `Folgende Dokumente sind keine PDFs: ${nonPdfs.map((d) => d.name).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Download all PDFs from MinIO (preserve order from request)
  const orderedDokumente = body.dokumentIds.map(
    (id) => dokumente.find((d) => d.id === id)!
  );

  const buffers: Buffer[] = [];
  const filenames: string[] = [];

  try {
    for (const dok of orderedDokumente) {
      const stream = await getFileStream(dok.dateipfad);
      if (!stream) {
        return NextResponse.json(
          { error: `Datei '${dok.name}' nicht im Speicher gefunden` },
          { status: 404 }
        );
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      buffers.push(Buffer.concat(chunks));
      filenames.push(dok.name);
    }
  } catch (err: any) {
    console.error("[PDF-MERGE] Download fehlgeschlagen:", err);
    return NextResponse.json(
      { error: "Quelldateien konnten nicht heruntergeladen werden" },
      { status: 500 }
    );
  }

  // Merge via Stirling-PDF
  let mergedBuffer: Buffer;
  try {
    mergedBuffer = await mergePdfs(buffers, filenames);
  } catch (err: any) {
    console.error("[PDF-MERGE] Zusammenfuehren fehlgeschlagen:", err);
    return NextResponse.json(
      {
        error: `PDF-Zusammenfuehrung fehlgeschlagen: ${err.message ?? "Stirling-PDF nicht erreichbar"}`,
      },
      { status: 502 }
    );
  }

  // Generate filename: user-provided or default with date
  const today = new Date().toISOString().slice(0, 10);
  const mergedName = body.name ?? `Zusammengefuehrt_${today}.pdf`;

  // Save merged PDF
  try {
    const storageKey = generateStorageKey(body.akteId, mergedName);
    await uploadFile(storageKey, mergedBuffer, "application/pdf", mergedBuffer.length);

    const newDokument = await prisma.dokument.create({
      data: {
        akteId: body.akteId,
        name: mergedName,
        dateipfad: storageKey,
        mimeType: "application/pdf",
        groesse: mergedBuffer.length,
        createdById: session.user.id,
      },
    });

    await logAuditEvent({
      userId: session.user.id,
      akteId: body.akteId,
      aktion: "DOKUMENT_HOCHGELADEN",
      details: {
        name: mergedName,
        operation: "merge",
        quellDokumente: orderedDokumente.map((d) => ({
          id: d.id,
          name: d.name,
        })),
        anzahl: orderedDokumente.length,
      },
    });

    return NextResponse.json({
      success: true,
      dokumentId: newDokument.id,
      name: newDokument.name,
      groesse: newDokument.groesse,
    });
  } catch (err: any) {
    console.error("[PDF-MERGE] Speichern fehlgeschlagen:", err);
    return NextResponse.json(
      { error: "Zusammengefuehrtes PDF konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }
}
