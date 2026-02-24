import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile, getDownloadUrl, uploadFile } from "@/lib/storage";
import { extractPlatzhalterFromDocx } from "@/lib/vorlagen";

/**
 * GET /api/vorlagen/[id] -- get a single template (or download it)
 * Query: download=true to redirect to presigned download URL
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
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download");

  const vorlage = await prisma.dokumentVorlage.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      freigegebenVon: { select: { name: true } },
      versionen: {
        orderBy: { version: "desc" },
        take: 10,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  // If download requested, redirect to pre-signed URL
  if (download === "true") {
    const url = await getDownloadUrl(vorlage.dateipfad);
    return NextResponse.redirect(url);
  }

  return NextResponse.json({
    vorlage: {
      ...vorlage,
      isFavorit: vorlage.favoritenVon.includes(session.user.id!),
    },
  });
}

/**
 * PUT /api/vorlagen/[id] -- update template with new DOCX file (creates version snapshot)
 * Accepts multipart/form-data with optional:
 *   - file: New DOCX template file (triggers versioning)
 *   - name, beschreibung, kategorie, tags, customFelder: Metadata updates
 */
export async function PUT(
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

  const vorlage = await prisma.dokumentVorlage.findUnique({ where: { id } });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const beschreibung = formData.get("beschreibung") as string | null;
  const kategorie = formData.get("kategorie") as string | null;
  const tagsRaw = formData.get("tags") as string | null;
  const customFelderRaw = formData.get("customFelder") as string | null;

  try {
    const updateData: any = {};
    if (name !== null) updateData.name = name.trim();
    if (beschreibung !== null) updateData.beschreibung = beschreibung || null;
    if (kategorie !== null) updateData.kategorie = kategorie;
    if (tagsRaw !== null) {
      updateData.tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (customFelderRaw !== null) {
      try {
        updateData.customFelder = JSON.parse(customFelderRaw);
      } catch {
        return NextResponse.json(
          { error: "Ungueltiges customFelder JSON" },
          { status: 400 }
        );
      }
    }

    // If a new file is uploaded, create a version snapshot of the current file
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Create version snapshot of current template
      await prisma.vorlageVersion.create({
        data: {
          vorlageId: id,
          version: vorlage.version,
          dateipfad: vorlage.dateipfad,
          groesse: vorlage.groesse,
          createdById: session.user.id!,
        },
      });

      // Extract placeholders from new template
      let platzhalter: string[] = [];
      try {
        platzhalter = extractPlatzhalterFromDocx(buffer);
      } catch {
        // OK if no placeholders
      }

      // Upload new file
      const timestamp = Date.now();
      const sanitized = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const storageKey = `vorlagen/${timestamp}_${sanitized}`;
      await uploadFile(storageKey, buffer, file.type, file.size);

      updateData.dateipfad = storageKey;
      updateData.dateiname = file.name;
      updateData.groesse = file.size;
      updateData.platzhalter = platzhalter;
      updateData.version = vorlage.version + 1;
    }

    const updated = await prisma.dokumentVorlage.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { name: true } },
        freigegebenVon: { select: { name: true } },
      },
    });

    return NextResponse.json({ vorlage: updated });
  } catch (err: any) {
    console.error("Template update error:", err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? "Fehler beim Aktualisieren" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vorlagen/[id] -- toggle favorite or update metadata
 * Body: { action: "favorite" } to toggle favorite
 * Body: { name?, beschreibung?, kategorie? } to update metadata
 */
export async function PATCH(
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
  const body = await request.json();

  const vorlage = await prisma.dokumentVorlage.findUnique({ where: { id } });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  // Toggle favorite
  if (body.action === "favorite") {
    const userId = session.user.id!;
    const isFavorited = vorlage.favoritenVon.includes(userId);
    const updatedFavoriten = isFavorited
      ? vorlage.favoritenVon.filter((id) => id !== userId)
      : [...vorlage.favoritenVon, userId];

    const updated = await prisma.dokumentVorlage.update({
      where: { id },
      data: { favoritenVon: updatedFavoriten },
      include: { createdBy: { select: { name: true } } },
    });

    return NextResponse.json({
      vorlage: {
        ...updated,
        isFavorit: !isFavorited,
      },
    });
  }

  // Update metadata
  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.beschreibung !== undefined)
    updateData.beschreibung = body.beschreibung || null;
  if (body.kategorie !== undefined) updateData.kategorie = body.kategorie;
  if (body.tags !== undefined) updateData.tags = body.tags;

  const updated = await prisma.dokumentVorlage.update({
    where: { id },
    data: updateData,
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json({ vorlage: updated });
}

/**
 * DELETE /api/vorlagen/[id] -- delete a template and all its versions
 */
export async function DELETE(
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

  const vorlage = await prisma.dokumentVorlage.findUnique({
    where: { id },
    include: { versionen: true },
  });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  // Delete current file from MinIO
  try {
    await deleteFile(vorlage.dateipfad);
  } catch {
    // Continue even if file deletion fails
  }

  // Delete version files from MinIO
  for (const version of vorlage.versionen) {
    try {
      await deleteFile(version.dateipfad);
    } catch {
      // Continue
    }
  }

  // Delete record (cascade will remove versions)
  await prisma.dokumentVorlage.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
