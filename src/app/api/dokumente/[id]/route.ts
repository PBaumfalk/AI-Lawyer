import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFile, getFileStream } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { removeDokumentFromIndex, indexDokument } from "@/lib/meilisearch";
import { requireAuth, requirePermission, requireAkteAccess } from "@/lib/rbac";

/**
 * GET /api/dokumente/[id] -- get document info + pre-signed download URL
 * ?download=true -- returns the actual file stream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "true";
  // ?inline=true -- stream original file inline (for PDF viewer in browser)
  const inline = searchParams.get("inline") === "true";
  // ?preview=true -- stream previewPfad inline (converted PDF for DOCX/images)
  const previewFile = searchParams.get("preview") === "true";

  // ?detail=true returns full document with relations for document detail page
  const detail = searchParams.get("detail") === "true";

  if (detail) {
    const dokument = await prisma.dokument.findUnique({
      where: { id },
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
        createdBy: { select: { id: true, name: true } },
        freigegebenDurch: { select: { id: true, name: true } },
        versionen: {
          orderBy: { version: "desc" },
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!dokument) {
      return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
    }

    // RBAC: check access to the parent Akte
    const access = await requireAkteAccess(dokument.akteId);
    if (access.error) return access.error;

    // Count DocumentChunks to show AI-indexed status
    const chunkCount = await prisma.documentChunk.count({
      where: { dokumentId: id },
    });

    // Generate proxy URLs (browser always talks to Next.js, not MinIO directly)
    const downloadUrl = `/api/dokumente/${id}?download=true`;
    let previewUrl: string | null = null;

    if (dokument.mimeType === "application/pdf") {
      previewUrl = `/api/dokumente/${id}?inline=true`;
    } else if (dokument.previewPfad) {
      previewUrl = `/api/dokumente/${id}?preview=true`;
    }

    return NextResponse.json({
      ...dokument,
      downloadUrl,
      previewUrl,
      chunkCount,
    });
  }

  // Simple mode: basic document info
  const dokument = await prisma.dokument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      freigegebenDurch: { select: { id: true, name: true } },
    },
  });

  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to the parent Akte
  const access = await requireAkteAccess(dokument.akteId);
  if (access.error) return access.error;

  if (download) {
    try {
      const stream = await getFileStream(dokument.dateipfad);
      if (!stream) {
        return NextResponse.json({ error: "Datei nicht gefunden im Speicher" }, { status: 404 });
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

  // Inline streaming (no attachment header) -- for PDF viewer in browser
  if (inline) {
    try {
      const stream = await getFileStream(dokument.dateipfad);
      if (!stream) {
        return NextResponse.json({ error: "Datei nicht gefunden im Speicher" }, { status: 404 });
      }
      const webStream = stream.transformToWebStream();
      return new NextResponse(webStream as any, {
        headers: {
          "Content-Type": dokument.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(dokument.name)}"`,
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

  // Preview PDF streaming -- serves the generated previewPfad (DOCX/image converted to PDF)
  if (previewFile) {
    if (!dokument.previewPfad) {
      return NextResponse.json({ error: "Keine Vorschau verfuegbar" }, { status: 404 });
    }
    try {
      const stream = await getFileStream(dokument.previewPfad);
      if (!stream) {
        return NextResponse.json({ error: "Vorschau nicht gefunden im Speicher" }, { status: 404 });
      }
      const webStream = stream.transformToWebStream();
      return new NextResponse(webStream as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(dokument.name)}.pdf"`,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Vorschau konnte nicht geladen werden" },
        { status: 500 }
      );
    }
  }

  // Return metadata + proxy download URL
  return NextResponse.json({
    ...dokument,
    downloadUrl: `/api/dokumente/${id}?download=true`,
  });
}

/**
 * PATCH /api/dokumente/[id] -- update document metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;
  const body = await request.json();

  const dokument = await prisma.dokument.findUnique({ where: { id } });
  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to the parent Akte with edit permission
  const access = await requireAkteAccess(dokument.akteId, { requireEdit: true });
  if (access.error) return access.error;

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.ordner !== undefined) updateData.ordner = body.ordner || null;
  if (body.tags !== undefined) updateData.tags = body.tags;

  // Status transitions (human users only, not for VERSENDET -- that's via send endpoints)
  if (body.status !== undefined) {
    const currentStatus = dokument.status;
    const targetStatus = body.status;

    if (targetStatus === "VERSENDET") {
      return NextResponse.json(
        { error: "Status 'VERSENDET' kann nur ueber Versand-Endpoints gesetzt werden." },
        { status: 403 }
      );
    }

    // RBAC: Freigeben requires canFreigeben permission
    if (targetStatus === "FREIGEGEBEN") {
      const permResult = await requirePermission("canFreigeben");
      if (permResult.error) return permResult.error;
    }

    // Revoking approval also requires canFreigeben
    if (currentStatus === "FREIGEGEBEN" && targetStatus !== "FREIGEGEBEN") {
      const permResult = await requirePermission("canFreigeben");
      if (permResult.error) return permResult.error;
    }

    const allowedTransitions: Record<string, string[]> = {
      ENTWURF: ["ZUR_PRUEFUNG"],
      ZUR_PRUEFUNG: ["ENTWURF", "FREIGEGEBEN"],
      FREIGEGEBEN: ["ZUR_PRUEFUNG"], // Can revoke approval
      // VERSENDET is set only by send endpoints, not via PATCH
    };

    const allowed = allowedTransitions[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Statusaenderung von '${currentStatus}' zu '${targetStatus}' ist nicht erlaubt.` },
        { status: 400 }
      );
    }

    updateData.status = targetStatus;

    // Set approval metadata when approving
    if (targetStatus === "FREIGEGEBEN") {
      updateData.freigegebenDurchId = session.user.id;
      updateData.freigegebenAm = new Date();
    } else if (
      currentStatus === "FREIGEGEBEN" &&
      targetStatus !== "FREIGEGEBEN"
    ) {
      // Revoke approval -- clear metadata
      updateData.freigegebenDurchId = null;
      updateData.freigegebenAm = null;
    }
  }

  const updated = await prisma.dokument.update({
    where: { id },
    data: updateData,
    include: {
      akte: { select: { aktenzeichen: true, kurzrubrum: true } },
      createdBy: { select: { name: true } },
      freigegebenDurch: { select: { id: true, name: true } },
    },
  });

  // Audit log for status changes
  if (body.status !== undefined && body.status !== dokument.status) {
    const statusLabels: Record<string, string> = {
      ENTWURF: "Entwurf",
      ZUR_PRUEFUNG: "Zur Pruefung",
      FREIGEGEBEN: "Freigegeben",
      VERSENDET: "Versendet",
    };
    logAuditEvent({
      userId: session.user.id!,
      akteId: dokument.akteId,
      aktion: "DOKUMENT_STATUS_GEAENDERT",
      details: {
        dokumentId: id,
        name: dokument.name,
        vonStatus: statusLabels[dokument.status] ?? dokument.status,
        zuStatus: statusLabels[body.status] ?? body.status,
      },
    }).catch(() => {});
  }

  // Update Meilisearch index (non-blocking)
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

  return NextResponse.json(updated);
}

/**
 * DELETE /api/dokumente/[id] -- delete a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // RBAC: require canLoeschen permission (blocks SEKRETARIAT)
  const permResult = await requirePermission("canLoeschen");
  if (permResult.error) return permResult.error;
  const { session } = permResult;

  const { id } = await params;

  const dokument = await prisma.dokument.findUnique({ where: { id } });
  if (!dokument) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  // RBAC: check access to the parent Akte
  const access = await requireAkteAccess(dokument.akteId);
  if (access.error) return access.error;

  // Delete from storage
  try {
    await deleteFile(dokument.dateipfad);
  } catch {
    // Continue even if storage deletion fails
  }

  // Delete from database
  await prisma.dokument.delete({ where: { id } });

  // Remove from Meilisearch (non-blocking)
  removeDokumentFromIndex(id).catch(() => {});

  await logAuditEvent({
    userId: session.user.id!,
    akteId: dokument.akteId,
    aktion: "DOKUMENT_GELOESCHT",
    details: { name: dokument.name, mimeType: dokument.mimeType },
  });

  return NextResponse.json({ success: true });
}
