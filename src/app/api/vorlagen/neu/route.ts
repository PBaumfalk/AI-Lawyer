import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { createBlankDocx } from "@/lib/vorlagen";
import { requireAuth } from "@/lib/rbac";

/**
 * POST /api/vorlagen/neu — create a new blank DOCX template
 * Body JSON:
 *   - name: Display name for the template (required)
 *   - beschreibung: Optional description
 *   - kategorie: Template category (default: SONSTIGES)
 */
export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const body = await request.json();
  const name = (body.name as string)?.trim();
  const beschreibung = (body.beschreibung as string)?.trim() || null;
  const kategorie = (body.kategorie as string) || "SONSTIGES";

  if (!name) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 }
    );
  }

  try {
    // Generate blank DOCX
    const blankBuffer = createBlankDocx();
    const dateiname = name.endsWith(".docx") ? name : name + ".docx";

    // Upload to MinIO
    const timestamp = Date.now();
    const sanitized = dateiname
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const storageKey = `vorlagen/${timestamp}_${sanitized}`;

    await uploadFile(
      storageKey,
      blankBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      blankBuffer.length
    );

    // Create database record
    const vorlage = await prisma.dokumentVorlage.create({
      data: {
        name,
        beschreibung,
        kategorie: kategorie as any,
        dateipfad: storageKey,
        dateiname,
        groesse: blankBuffer.length,
        platzhalter: [],
        createdById: session.user.id!,
      },
      include: {
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ vorlage }, { status: 201 });
  } catch (err: any) {
    console.error("Blank template creation error:", err);
    return NextResponse.json(
      {
        error:
          err.message?.slice(0, 200) ??
          "Fehler beim Erstellen der Vorlage",
      },
      { status: 500 }
    );
  }
}
