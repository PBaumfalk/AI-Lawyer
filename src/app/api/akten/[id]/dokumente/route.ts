import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile, generateStorageKey } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { indexDokument } from "@/lib/meilisearch";

/**
 * GET /api/akten/[id]/dokumente — list documents for a case
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const ordner = searchParams.get("ordner");
  const q = searchParams.get("q");

  const where: any = { akteId: id };
  if (ordner === "__none__") {
    where.ordner = null;
  } else if (ordner) {
    where.ordner = ordner;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { ocrText: { contains: q, mode: "insensitive" } },
      { tags: { hasSome: [q] } },
    ];
  }

  const dokumente = await prisma.dokument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      freigegebenDurch: { select: { id: true, name: true } },
    },
  });

  // Also get list of distinct folders for this case
  const allDocs = await prisma.dokument.findMany({
    where: { akteId: id },
    select: { ordner: true },
    distinct: ["ordner"],
  });
  const ordnerList = allDocs
    .map((d) => d.ordner)
    .filter((o): o is string => o !== null)
    .sort();

  return NextResponse.json({ dokumente, ordnerList });
}

/**
 * POST /api/akten/[id]/dokumente — upload document(s) to a case
 * Accepts multipart/form-data with:
 *   - file: The file(s) to upload
 *   - ordner: Optional folder name
 *   - tags: Optional comma-separated tags
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id: akteId } = await params;
  const userId = session.user.id!;

  // Verify case exists
  const akte = await prisma.akte.findUnique({ where: { id: akteId } });
  if (!akte) {
    return NextResponse.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("file") as File[];
  const ordner = (formData.get("ordner") as string) || null;
  const tagsStr = formData.get("tags") as string | null;
  const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];

  if (files.length === 0) {
    return NextResponse.json({ error: "Keine Datei(en) hochgeladen" }, { status: 400 });
  }

  const uploaded: any[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = generateStorageKey(akteId, file.name);

      await uploadFile(storageKey, buffer, file.type, file.size);

      const dokument = await prisma.dokument.create({
        data: {
          akteId,
          name: file.name,
          dateipfad: storageKey,
          mimeType: file.type || "application/octet-stream",
          groesse: file.size,
          ordner,
          tags,
          createdById: userId,
        },
      });

      await logAuditEvent({
        userId,
        akteId,
        aktion: "DOKUMENT_HOCHGELADEN",
        details: { name: file.name, mimeType: file.type, groesse: file.size, ordner },
      });

      // Index in Meilisearch (non-blocking)
      indexDokument({
        id: dokument.id,
        akteId,
        name: file.name,
        mimeType: dokument.mimeType,
        ordner: dokument.ordner,
        tags: dokument.tags,
        ocrText: null,
        createdById: userId,
        createdByName: session.user.name ?? "",
        aktenzeichen: akte.aktenzeichen,
        kurzrubrum: akte.kurzrubrum,
        createdAt: Math.floor(new Date(dokument.createdAt).getTime() / 1000),
      }).catch(() => {}); // Silently fail if Meilisearch is down

      // Auto-Wiedervorlage: create WIEDERVORLAGE with priority DRINGEND when document is added
      const nextBusinessDay = new Date();
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
      // Skip weekends
      while (nextBusinessDay.getDay() === 0 || nextBusinessDay.getDay() === 6) {
        nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
      }

      const verantwortlichId = akte.anwaltId ?? akte.sachbearbeiterId ?? userId;
      await prisma.kalenderEintrag.create({
        data: {
          typ: "WIEDERVORLAGE",
          prioritaet: "DRINGEND",
          titel: `Neues Dokument: ${file.name}`,
          datum: nextBusinessDay,
          ganztaegig: true,
          akteId,
          verantwortlichId,
        },
      });

      await logAuditEvent({
        userId,
        akteId,
        aktion: "WIEDERVORLAGE_ERSTELLT",
        details: {
          automatisch: true,
          grund: "Neues Dokument hochgeladen",
          dokumentName: file.name,
          dokumentId: dokument.id,
        },
      });

      uploaded.push(dokument);
    } catch (err: any) {
      errors.push({ name: file.name, error: err.message?.slice(0, 100) ?? "Unbekannter Fehler" });
    }
  }

  return NextResponse.json({ uploaded, errors }, { status: 201 });
}
