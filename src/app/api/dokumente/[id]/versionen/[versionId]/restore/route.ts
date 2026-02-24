import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile, getFileStream } from "@/lib/storage";

/**
 * POST /api/dokumente/[id]/versionen/[versionId]/restore -- Restore a previous version.
 *
 * Non-destructive: Creates a new DokumentVersion snapshot of the current state,
 * copies the old version's file content to the document's dateipfad, and
 * increments the document version number. Old versions are preserved.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { id, versionId } = await params;
  const userId = session.user.id!;

  // Load current document state
  const dokument = await prisma.dokument.findUnique({
    where: { id },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // Load the version to restore
  const versionToRestore = await prisma.dokumentVersion.findUnique({
    where: { id: versionId },
  });

  if (!versionToRestore || versionToRestore.dokumentId !== id) {
    return NextResponse.json(
      { error: "Version nicht gefunden" },
      { status: 404 }
    );
  }

  // Schreibschutz check: Cannot restore approved/sent documents
  if (dokument.status === "FREIGEGEBEN" || dokument.status === "VERSENDET") {
    return NextResponse.json(
      {
        error:
          "Dokument ist schreibgeschuetzt. Status muss zurueckgesetzt werden bevor eine Version wiederhergestellt werden kann.",
      },
      { status: 403 }
    );
  }

  try {
    // 1. Snapshot current state before restore
    const currentSnapshotPath = `${dokument.dateipfad}_v${dokument.version}_pre_restore`;

    const currentStream = await getFileStream(dokument.dateipfad);
    if (currentStream) {
      const chunks: Uint8Array[] = [];
      const reader = (currentStream as ReadableStream).getReader();
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          chunks.push(result.value);
        }
      }
      const currentBuffer = Buffer.concat(chunks);

      await uploadFile(
        currentSnapshotPath,
        currentBuffer,
        dokument.mimeType,
        currentBuffer.length
      );

      // Create version record for the current state
      await prisma.dokumentVersion.create({
        data: {
          dokumentId: id,
          version: dokument.version,
          dateipfad: currentSnapshotPath,
          groesse: dokument.groesse,
          name: `Vor Wiederherstellung (v${versionToRestore.version})`,
          createdById: userId,
        },
      });
    }

    // 2. Copy the old version's file content to the document's dateipfad
    const restoreStream = await getFileStream(versionToRestore.dateipfad);
    if (!restoreStream) {
      return NextResponse.json(
        { error: "Versionsdatei konnte nicht gelesen werden" },
        { status: 500 }
      );
    }

    const chunks: Uint8Array[] = [];
    const reader = (restoreStream as ReadableStream).getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    const restoreBuffer = Buffer.concat(chunks);

    await uploadFile(
      dokument.dateipfad,
      restoreBuffer,
      dokument.mimeType,
      restoreBuffer.length
    );

    // 3. Increment document version number (new key = new editing session)
    const updated = await prisma.dokument.update({
      where: { id },
      data: {
        version: { increment: 1 },
        groesse: restoreBuffer.length,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        akteId: dokument.akteId,
        aktion: "DOKUMENT_VERSION_WIEDERHERGESTELLT",
        details: {
          dokumentId: id,
          dokumentName: dokument.name,
          restoredFromVersion: versionToRestore.version,
          newVersion: updated.version,
        },
      },
    });

    console.log(
      `[Versionen] Restored ${dokument.name} from v${versionToRestore.version} -> new v${updated.version}`
    );

    return NextResponse.json({
      id: updated.id,
      name: dokument.name,
      previousVersion: dokument.version,
      restoredFromVersion: versionToRestore.version,
      newVersion: updated.version,
    });
  } catch (err) {
    console.error("[Versionen] Error during restore:", err);
    return NextResponse.json(
      { error: "Wiederherstellung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
