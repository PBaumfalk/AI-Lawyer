/**
 * Admin Muster [id] API — DELETE + PATCH.
 *
 * DELETE /api/admin/muster/[id] — Delete Muster (chunks, MinIO object, DB row).
 * PATCH  /api/admin/muster/[id] — Retry NER for REJECTED or PENDING_NER Muster.
 *
 * Authentication: ADMIN role required.
 *
 * DELETE flow:
 * 1. Load Muster to get minioKey
 * 2. Delete muster_chunks rows
 * 3. Delete MinIO object
 * 4. Delete Muster DB row
 *
 * PATCH flow:
 * 1. Load Muster — 404 if not found
 * 2. Guard: only REJECTED_PII_DETECTED or PENDING_NER can be retried — 409 otherwise
 * 3. Reset nerStatus to PENDING_NER
 * 4. Enqueue fresh NER job
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { nerPiiQueue } from "@/lib/queue/queues";

/**
 * DELETE /api/admin/muster/[id]
 * Removes chunks, MinIO object, and Muster row (cascade-safe via raw SQL for chunks).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Load Muster to get minioKey before deletion
    const muster = await prisma.muster.findUnique({
      where: { id },
      select: { minioKey: true },
    });

    if (!muster) {
      return NextResponse.json({ error: "Muster nicht gefunden" }, { status: 404 });
    }

    // Delete muster_chunks first (not cascaded via Prisma schema in all setups)
    await prisma.$executeRaw`DELETE FROM muster_chunks WHERE "musterId" = ${id}`;

    // Delete MinIO object (best-effort — don't fail if file already gone)
    try {
      await deleteFile(muster.minioKey);
    } catch {
      // MinIO deletion failure is non-fatal — row will be deleted regardless
    }

    // Delete Muster row
    await prisma.muster.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Muster konnte nicht gelöscht werden: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/muster/[id]
 * Retry NER processing for a REJECTED_PII_DETECTED or PENDING_NER Muster.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const muster = await prisma.muster.findUnique({
      where: { id },
      select: { nerStatus: true },
    });

    if (!muster) {
      return NextResponse.json({ error: "Muster nicht gefunden" }, { status: 404 });
    }

    // Only REJECTED or PENDING_NER can be retried
    if (
      muster.nerStatus !== "REJECTED_PII_DETECTED" &&
      muster.nerStatus !== "PENDING_NER"
    ) {
      return NextResponse.json(
        { error: "Nur REJECTED oder PENDING_NER können erneut geprüft werden" },
        { status: 409 }
      );
    }

    // Reset to PENDING_NER and enqueue fresh NER job
    await prisma.muster.update({
      where: { id },
      data: { nerStatus: "PENDING_NER" },
    });

    await nerPiiQueue.add("ner-muster-retry", { musterId: id });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `NER-Wiederholung fehlgeschlagen: ${message}` },
      { status: 500 }
    );
  }
}
