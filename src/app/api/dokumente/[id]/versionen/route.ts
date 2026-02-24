import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile, getFileStream } from "@/lib/storage";

/**
 * GET /api/dokumente/[id]/versionen -- List all versions for a document.
 * Returns versions ordered by version number DESC, including creator name and snapshot name.
 */
export async function GET(
  request: NextRequest,
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
    select: { id: true, version: true, name: true },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  const versionen = await prisma.dokumentVersion.findMany({
    where: { dokumentId: id },
    orderBy: { version: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({
    dokumentId: id,
    currentVersion: dokument.version,
    versionen: versionen.map((v) => ({
      id: v.id,
      version: v.version,
      name: v.name,
      groesse: v.groesse,
      createdBy: v.createdBy.name,
      createdById: v.createdBy.id,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/dokumente/[id]/versionen -- Create a named snapshot of the current document.
 * Body: { name: string }
 *
 * Creates a DokumentVersion record with the current document content and the given name.
 */
export async function POST(
  request: NextRequest,
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
  const userId = session.user.id!;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 }
    );
  }

  const dokument = await prisma.dokument.findUnique({
    where: { id },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // Copy current file to version-specific path
  const versionPath = `${dokument.dateipfad}_v${dokument.version}_snapshot`;

  try {
    // Read current file content from MinIO
    const stream = await getFileStream(dokument.dateipfad);
    if (!stream) {
      return NextResponse.json(
        { error: "Datei konnte nicht gelesen werden" },
        { status: 500 }
      );
    }

    const chunks: Uint8Array[] = [];
    const reader = (stream as ReadableStream).getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    const buffer = Buffer.concat(chunks);

    // Upload snapshot to versioned path
    await uploadFile(versionPath, buffer, dokument.mimeType, buffer.length);
  } catch (err) {
    console.error("[Versionen] Failed to copy file for snapshot:", err);
    return NextResponse.json(
      { error: "Snapshot konnte nicht erstellt werden" },
      { status: 500 }
    );
  }

  // Create version record with name
  const version = await prisma.dokumentVersion.create({
    data: {
      dokumentId: id,
      version: dokument.version,
      dateipfad: versionPath,
      groesse: dokument.groesse,
      name: name.trim(),
      createdById: userId,
    },
    include: {
      createdBy: { select: { name: true } },
    },
  });

  console.log(
    `[Versionen] Named snapshot created: "${name.trim()}" for ${dokument.name} v${dokument.version}`
  );

  return NextResponse.json(
    {
      id: version.id,
      version: version.version,
      name: version.name,
      groesse: version.groesse,
      createdBy: version.createdBy.name,
      createdAt: version.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
