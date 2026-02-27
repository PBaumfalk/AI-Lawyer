/**
 * Admin Muster API — GET (list) + POST (upload).
 *
 * GET  /api/admin/muster — List all Muster ordered by createdAt desc.
 * POST /api/admin/muster — Upload a new kanzlei-eigenes Muster (DOCX or PDF).
 *
 * Authentication: ADMIN role required.
 *
 * POST flow:
 * 1. Parse multipart form data (file, name, kategorie, optional beschreibung)
 * 2. Validate MIME type (PDF and DOCX only)
 * 3. Upload file to MinIO under muster-uploads/
 * 4. Create Muster DB row with isKanzleiEigen: true, nerStatus: PENDING_NER
 * 5. Enqueue nerPiiQueue job for async NER filtering (ARBW-03 compliance)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { nerPiiQueue } from "@/lib/queue/queues";

/** Allowed MIME types for Muster uploads */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * GET /api/admin/muster
 * Returns all Muster ordered by createdAt desc with uploader name and chunk count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const muster = await prisma.muster.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
        _count: { select: { chunks: true } },
      },
    });

    return NextResponse.json({ muster });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Muster konnten nicht geladen werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/muster
 * Upload a new kanzlei-eigenes Muster (PDF or DOCX).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;

  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string | null)?.trim();
    const kategorie = (formData.get("kategorie") as string | null)?.trim();
    const beschreibung = (formData.get("beschreibung") as string | null)?.trim() || null;

    // Validate required fields
    if (!file || !name || !kategorie) {
      return NextResponse.json(
        { error: "Datei, Name und Kategorie sind erforderlich" },
        { status: 400 }
      );
    }

    // Validate MIME type — only PDF and DOCX allowed
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Ungültiger Dateityp: ${file.type}. Erlaubt: PDF und DOCX`,
        },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Create Muster row with placeholder minioKey — updated after upload
    const muster = await prisma.muster.create({
      data: {
        name,
        kategorie,
        beschreibung,
        minioKey: "placeholder",
        mimeType: file.type,
        nerStatus: "PENDING_NER",
        isKanzleiEigen: true,
        uploadedById: userId,
      },
    });

    // Build storage key: muster-uploads/{id}_{sanitized filename}
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const minioKey = `muster-uploads/${muster.id}_${sanitizedName}`;

    // Upload to MinIO
    await uploadFile(minioKey, buffer, file.type, buffer.length);

    // Update Muster with real minioKey
    const updated = await prisma.muster.update({
      where: { id: muster.id },
      data: { minioKey },
    });

    // Enqueue NER-PII check (ARBW-03 compliance gate)
    await nerPiiQueue.add("ner-muster", { musterId: muster.id });

    return NextResponse.json({ muster: updated }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Muster-Upload fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
