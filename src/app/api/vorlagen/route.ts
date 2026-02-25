import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { extractPlatzhalterFromDocx } from "@/lib/vorlagen";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/vorlagen -- list all templates
 * Query params: kategorie, tags (comma-separated), freigegeben (true/false), q (search)
 * Sorting: favorites first, then by kategorie + name
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const kategorie = searchParams.get("kategorie");
  const tags = searchParams.get("tags");
  const freigegeben = searchParams.get("freigegeben");
  const q = searchParams.get("q");

  const where: any = {};
  if (kategorie) where.kategorie = kategorie;
  if (freigegeben === "true") where.freigegeben = true;
  if (freigegeben === "false") where.freigegeben = false;
  if (tags) {
    // Filter templates that have ANY of the specified tags
    where.tags = { hasSome: tags.split(",").map((t) => t.trim()) };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { beschreibung: { contains: q, mode: "insensitive" } },
      { tags: { hasSome: [q] } },
    ];
  }

  const vorlagen = await prisma.dokumentVorlage.findMany({
    where,
    orderBy: [{ kategorie: "asc" }, { name: "asc" }],
    include: {
      createdBy: { select: { name: true } },
      freigegebenVon: { select: { name: true } },
    },
  });

  // Sort: favorites first for the current user
  const userId = session.user.id!;
  const sorted = vorlagen.sort((a, b) => {
    const aFav = a.favoritenVon.includes(userId) ? 0 : 1;
    const bFav = b.favoritenVon.includes(userId) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return 0; // Preserve DB ordering (kategorie, name) for non-favorites
  });

  // Add isFavorit flag for the current user
  const vorlagenWithFav = sorted.map((v) => ({
    ...v,
    isFavorit: v.favoritenVon.includes(userId),
  }));

  return NextResponse.json({ vorlagen: vorlagenWithFav });
}

/**
 * POST /api/vorlagen -- upload a new DOCX template
 * Accepts multipart/form-data with:
 *   - file: The DOCX template file
 *   - name: Display name
 *   - beschreibung: Optional description
 *   - kategorie: Template category
 *   - tags: Comma-separated tags
 *   - customFelder: JSON string of custom field definitions
 */
export async function POST(request: NextRequest) {
  const postResult = await requireAuth();
  if (postResult.error) return postResult.error;
  const session = postResult.session;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const beschreibung = (formData.get("beschreibung") as string) || null;
  const kategorie = (formData.get("kategorie") as string) || "SONSTIGES";
  const tagsRaw = (formData.get("tags") as string) || "";
  const customFelderRaw = (formData.get("customFelder") as string) || null;

  if (!file) {
    return NextResponse.json(
      { error: "Keine Datei hochgeladen" },
      { status: 400 }
    );
  }

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 }
    );
  }

  // Validate DOCX mime type
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream", // some browsers send this
  ];
  if (!validTypes.includes(file.type) && !file.name.endsWith(".docx")) {
    return NextResponse.json(
      { error: "Nur DOCX-Dateien werden als Vorlagen unterstuetzt" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract placeholders from the template
    let platzhalter: string[] = [];
    try {
      platzhalter = extractPlatzhalterFromDocx(buffer);
    } catch {
      // Template may not contain placeholders -- that's OK
    }

    // Parse tags
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Parse custom field definitions
    let customFelder = null;
    if (customFelderRaw) {
      try {
        customFelder = JSON.parse(customFelderRaw);
      } catch {
        return NextResponse.json(
          { error: "Ungueltiges customFelder JSON" },
          { status: 400 }
        );
      }
    }

    // Upload to MinIO
    const timestamp = Date.now();
    const sanitized = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const storageKey = `vorlagen/${timestamp}_${sanitized}`;
    await uploadFile(storageKey, buffer, file.type, file.size);

    // Create database record (new templates start as draft)
    const vorlage = await prisma.dokumentVorlage.create({
      data: {
        name: name.trim(),
        beschreibung,
        kategorie: kategorie as any,
        dateipfad: storageKey,
        dateiname: file.name,
        groesse: file.size,
        platzhalter,
        tags,
        customFelder,
        freigegeben: false,
        createdById: session.user.id!,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ vorlage }, { status: 201 });
  } catch (err: any) {
    console.error("Template upload error:", err);
    return NextResponse.json(
      {
        error:
          err.message?.slice(0, 200) ??
          "Fehler beim Hochladen der Vorlage",
      },
      { status: 500 }
    );
  }
}
