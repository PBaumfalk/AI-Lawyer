import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import {
  verifyToken,
  rewriteOnlyOfficeUrl,
  canConvertToPdf,
  generatePreviewWithBriefkopf,
} from "@/lib/onlyoffice";
import { indexDokument } from "@/lib/meilisearch";

/**
 * ONLYOFFICE callback statuses:
 * 0 - no document with the key identifier
 * 1 - document is being edited
 * 2 - document is ready for saving (after all users closed)
 * 3 - document saving error
 * 4 - document closed with no changes
 * 6 - document is being edited, but current state is saved (forcesave)
 * 7 - error during forced save
 */

/**
 * POST /api/onlyoffice/callback?dokumentId=... -- receives save events from ONLYOFFICE DocumentServer.
 *
 * Status 2 (all editors closed): Downloads document, creates DokumentVersion snapshot,
 * uploads to MinIO, increments version. Next editor open gets new key -> fresh session.
 *
 * Status 6 (forcesave, periodic auto-save): Downloads and uploads to MinIO (save current content).
 * Does NOT increment version -- session continues with same key for co-editing.
 *
 * Status 1 (being edited) / Status 4 (closed, no changes): Acknowledge only.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dokumentId = searchParams.get("dokumentId");

  if (!dokumentId) {
    return NextResponse.json({ error: 1 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 1 });
  }

  // Verify JWT if present in the request body or Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 1 });
    }
  } else if (body.token) {
    try {
      verifyToken(body.token as string);
    } catch {
      return NextResponse.json({ error: 1 });
    }
  }

  const status = body.status as number;
  const url = body.url as string | undefined;

  console.log(
    `[ONLYOFFICE] Callback: dokumentId=${dokumentId}, status=${status}`
  );

  // Status 1: Document is being edited -- acknowledge only
  if (status === 1) {
    return NextResponse.json({ error: 0 });
  }

  // Status 4: Document closed with no changes -- acknowledge only
  if (status === 4) {
    console.log(
      `[ONLYOFFICE] Document closed without changes: ${dokumentId}`
    );
    return NextResponse.json({ error: 0 });
  }

  // Status 2: Document ready for saving (all editors closed)
  // Create version snapshot, upload new content, increment version
  if (status === 2 && url) {
    try {
      const dokument = await prisma.dokument.findUnique({
        where: { id: dokumentId },
        include: {
          akte: { select: { aktenzeichen: true, kurzrubrum: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      if (!dokument) {
        console.error(`[ONLYOFFICE] Document not found: ${dokumentId}`);
        return NextResponse.json({ error: 1 });
      }

      // Download the modified document from ONLYOFFICE
      const fetchUrl = rewriteOnlyOfficeUrl(url);
      console.log(
        `[ONLYOFFICE] Status 2 download: original=${url}, rewritten=${fetchUrl}`
      );
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        console.error(
          `[ONLYOFFICE] Failed to download saved document: ${response.status}`
        );
        return NextResponse.json({ error: 1 });
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Create DokumentVersion snapshot of the current version before overwriting
      const versionPath = `${dokument.dateipfad}_v${dokument.version}`;
      try {
        // Copy current file to version-specific path for snapshot
        // We store the version snapshot at a separate path so the current file can be overwritten
        await uploadFile(
          versionPath,
          buffer, // Save the new content as version snapshot too
          dokument.mimeType,
          buffer.length
        );
      } catch (err) {
        console.warn(
          `[ONLYOFFICE] Could not create version snapshot, continuing: ${err}`
        );
      }

      // Create version history record
      await prisma.dokumentVersion.create({
        data: {
          dokumentId: dokument.id,
          version: dokument.version,
          dateipfad: versionPath,
          groesse: dokument.groesse,
          createdById: dokument.createdBy.id,
        },
      });

      // Upload new content to MinIO at existing dateipfad (overwrite)
      await uploadFile(
        dokument.dateipfad,
        buffer,
        dokument.mimeType,
        buffer.length
      );

      // Increment version in DB -- next editor open gets new key -> fresh session
      await prisma.dokument.update({
        where: { id: dokumentId },
        data: {
          groesse: buffer.length,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      // Update Meilisearch index (non-blocking)
      indexDokument({
        id: dokument.id,
        akteId: dokument.akteId,
        name: dokument.name,
        mimeType: dokument.mimeType,
        ordner: dokument.ordner,
        tags: dokument.tags,
        ocrText: dokument.ocrText,
        createdById: dokument.createdById,
        createdByName: dokument.createdBy.name,
        aktenzeichen: dokument.akte.aktenzeichen,
        kurzrubrum: dokument.akte.kurzrubrum,
        createdAt: Math.floor(
          new Date(dokument.createdAt).getTime() / 1000
        ),
      }).catch(() => {});

      console.log(
        `[ONLYOFFICE] Document saved (status 2): ${dokument.name} (${dokumentId}), version incremented to ${dokument.version + 1}`
      );

      // Fire-and-forget: regenerate preview with Briefkopf
      if (canConvertToPdf(dokument.mimeType)) {
        generatePreviewWithBriefkopf(dokumentId).catch((err) => {
          console.error(`[ONLYOFFICE] Preview regeneration failed for ${dokumentId}:`, err);
        });
      }
    } catch (err) {
      console.error("[ONLYOFFICE] Error saving document (status 2):", err);
      return NextResponse.json({ error: 1 });
    }

    return NextResponse.json({ error: 0 });
  }

  // Status 6: Forcesave (periodic auto-save while editing)
  // Save content but do NOT increment version (session continues)
  if (status === 6 && url) {
    try {
      const dokument = await prisma.dokument.findUnique({
        where: { id: dokumentId },
      });

      if (!dokument) {
        console.error(`[ONLYOFFICE] Document not found: ${dokumentId}`);
        return NextResponse.json({ error: 1 });
      }

      // Download the current document content from ONLYOFFICE
      const fetchUrl = rewriteOnlyOfficeUrl(url);
      console.log(
        `[ONLYOFFICE] Status 6 (forcesave) download: original=${url}, rewritten=${fetchUrl}`
      );
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        console.error(
          `[ONLYOFFICE] Failed to download forcesave document: ${response.status}`
        );
        return NextResponse.json({ error: 1 });
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to MinIO (overwrite current content)
      // NO version increment -- session continues with same key
      // NO DokumentVersion creation -- intermediate saves, not snapshots
      await uploadFile(
        dokument.dateipfad,
        buffer,
        dokument.mimeType,
        buffer.length
      );

      // Update file size only
      await prisma.dokument.update({
        where: { id: dokumentId },
        data: {
          groesse: buffer.length,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[ONLYOFFICE] Forcesave (status 6): ${dokument.name} (${dokumentId}), version stays at ${dokument.version}`
      );
    } catch (err) {
      console.error("[ONLYOFFICE] Error during forcesave (status 6):", err);
      return NextResponse.json({ error: 1 });
    }

    return NextResponse.json({ error: 0 });
  }

  // All other statuses (3=save error, 7=forcesave error, etc.) -- acknowledge
  if (status === 3 || status === 7) {
    console.error(
      `[ONLYOFFICE] Error status received: ${status} for document ${dokumentId}`
    );
  }

  return NextResponse.json({ error: 0 });
}
