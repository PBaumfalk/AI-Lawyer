import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { requireMandantAkteAccess } from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { uploadFile, generateStorageKey } from "@/lib/storage";
import { createNotification } from "@/lib/notifications/service";
import { logAuditEvent } from "@/lib/audit";

// Portal uploads limited to 50MB (lower than internal 100MB for portal security)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * POST /api/portal/akten/[id]/dokumente/upload
 * Mandant uploads a file into the dedicated "Mandant" Ordner.
 * Simplified pipeline: NO OCR, NO RAG, NO preview, NO Wiedervorlage.
 * Creates AktenActivity + Notification to Anwalt.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // Authenticate
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { session } = authResult;

  // Only MANDANT users may access portal endpoints
  if ((session.user as any).role !== "MANDANT") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  // Verify Mandant access to this Akte
  const access = await requireMandantAkteAccess(akteId, session.user.id);
  if (access.error) return access.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen" },
        { status: 400 }
      );
    }

    // Enforce 50MB file size limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Maximale Dateigroesse: 50 MB" },
        { status: 413 }
      );
    }

    // Fetch Akte details (need anwaltId for createdById fallback + notification)
    const akte = await prisma.akte.findUnique({
      where: { id: akteId },
      select: { anwaltId: true, aktenzeichen: true, kurzrubrum: true },
    });

    if (!akte) {
      return NextResponse.json(
        { error: "Akte nicht gefunden" },
        { status: 404 }
      );
    }

    // Upload to MinIO
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = generateStorageKey(akteId, file.name);
    await uploadFile(storageKey, buffer, file.type, file.size);

    // createdById strategy: Mandant is not an internal User with direct Dokument FK.
    // Use Akte's anwaltId as fallback (Dokument model requires User FK).
    // erstelltDurch="mandant" distinguishes origin.
    const createdById = akte.anwaltId ?? session.user.id;

    // Create document record (simplified: no OCR, no RAG, no preview)
    const dokument = await prisma.dokument.create({
      data: {
        akteId,
        name: file.name,
        dateipfad: storageKey,
        mimeType: file.type || "application/octet-stream",
        groesse: file.size,
        ordner: "Mandant",
        erstelltDurch: "mandant",
        ocrStatus: "NICHT_NOETIG",
        createdById,
        mandantSichtbar: true,
      },
    });

    // Audit log for upload action
    await logAuditEvent({
      userId: session.user.id,
      akteId,
      aktion: "MANDANT_UPLOAD",
      details: {
        name: file.name,
        mimeType: file.type,
        groesse: file.size,
        dokumentId: dokument.id,
      },
    });

    // Create AktenActivity (visible to Mandant)
    await prisma.aktenActivity.create({
      data: {
        akteId,
        typ: "DOKUMENT",
        titel: `Mandant hat Dokument "${file.name}" hochgeladen`,
        meta: { dokumentId: dokument.id, erstelltDurch: "mandant" },
        mandantSichtbar: true,
      },
    });

    // Notify Anwalt about the upload
    if (akte.anwaltId) {
      await createNotification({
        userId: akte.anwaltId,
        type: "document:mandant-upload",
        title: "Mandant-Upload",
        message: `Neues Dokument "${file.name}" in Akte ${akte.aktenzeichen} hochgeladen`,
        data: { akteId, dokumentId: dokument.id, fileName: file.name },
      }).catch((err) => {
        // Non-fatal: document is already persisted
        console.error("[PORTAL] Failed to send notification:", err);
      });
    }

    return NextResponse.json(
      {
        dokument: {
          id: dokument.id,
          name: dokument.name,
          groesse: dokument.groesse,
          createdAt: dokument.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PORTAL] Error uploading document:", error);
    return NextResponse.json(
      { error: "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
