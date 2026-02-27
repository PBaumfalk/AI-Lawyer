import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile, getFileStream } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { indexDokument } from "@/lib/meilisearch";
import { resolvePlatzhalter, fillDocxTemplate } from "@/lib/vorlagen";
import { applyBriefkopfToDocx } from "@/lib/briefkopf";
import { requireAkteAccess } from "@/lib/rbac";

/**
 * POST /api/akten/[id]/dokumente/aus-vorlage -- create a document from a template
 * Body JSON:
 *   - vorlageId: ID of the template to use
 *   - dateiname: Desired output filename (optional, defaults to template name)
 *   - ordner: Optional folder to place the document in
 *   - tags: Optional array of tags
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  // RBAC: check Akte access with edit permission
  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;
  const userId = session.user.id;

  // Parse body
  const body = await request.json();
  const { vorlageId, dateiname, ordner, tags, briefkopfId } = body;

  if (!vorlageId) {
    return NextResponse.json({ error: "vorlageId ist erforderlich" }, { status: 400 });
  }

  // Load template
  const vorlage = await prisma.dokumentVorlage.findUnique({
    where: { id: vorlageId },
  });
  if (!vorlage) {
    return NextResponse.json({ error: "Vorlage nicht gefunden" }, { status: 404 });
  }

  // Load case with all related data needed for placeholder resolution
  const akte = await prisma.akte.findUnique({
    where: { id: akteId },
    include: {
      anwalt: { select: { name: true, email: true, telefon: true } },
      kanzlei: {
        select: {
          name: true,
          strasse: true,
          plz: true,
          ort: true,
          telefon: true,
          fax: true,
          email: true,
          website: true,
          steuernr: true,
          ustIdNr: true,
          iban: true,
          bic: true,
          bankName: true,
        },
      },
      beteiligte: {
        include: {
          kontakt: {
            select: {
              anrede: true,
              titel: true,
              vorname: true,
              nachname: true,
              firma: true,
              strasse: true,
              plz: true,
              ort: true,
              email: true,
              telefon: true,
            },
          },
        },
      },
    },
  });

  if (!akte) {
    return NextResponse.json({ error: "Akte nicht gefunden" }, { status: 404 });
  }

  try {
    // Download template from MinIO
    const stream = await getFileStream(vorlage.dateipfad);
    if (!stream) {
      return NextResponse.json(
        { error: "Vorlagen-Datei nicht gefunden im Speicher" },
        { status: 500 }
      );
    }

    // Convert stream to Buffer
    const chunks: Uint8Array[] = [];
    const reader = (stream as ReadableStream).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const templateBuffer = Buffer.concat(chunks);

    // Resolve placeholder data from case
    const placeholderData = resolvePlatzhalter({
      aktenzeichen: akte.aktenzeichen,
      kurzrubrum: akte.kurzrubrum,
      wegen: akte.wegen,
      sachgebiet: akte.sachgebiet,
      gegenstandswert: akte.gegenstandswert,
      anwalt: akte.anwalt,
      kanzlei: akte.kanzlei,
      beteiligte: akte.beteiligte.map((b) => ({
        rolle: b.rolle,
        kontakt: b.kontakt,
      })),
    });

    // Fill template with data
    let filledBuffer = fillDocxTemplate(templateBuffer, placeholderData);

    // Apply Briefkopf (letterhead) if available
    let briefkopf = null;
    if (briefkopfId) {
      briefkopf = await prisma.briefkopf.findUnique({
        where: { id: briefkopfId },
      });
    }
    if (!briefkopf) {
      // Fall back to default Briefkopf
      briefkopf = await prisma.briefkopf.findFirst({
        where: { istStandard: true },
      });
    }

    if (briefkopf?.dateipfad) {
      try {
        const bkStream = await getFileStream(briefkopf.dateipfad);
        if (bkStream) {
          const bkChunks: Uint8Array[] = [];
          for await (const chunk of bkStream as AsyncIterable<Uint8Array>) {
            bkChunks.push(chunk);
          }
          const briefkopfBuffer = Buffer.concat(bkChunks);
          filledBuffer = applyBriefkopfToDocx(filledBuffer, briefkopfBuffer);
        }
      } catch (err) {
        console.error("[AusVorlage] Briefkopf apply failed:", err);
        // Continue without Briefkopf rather than failing
      }
    }

    // Generate output filename
    const outputName = dateiname?.trim()
      ? dateiname.trim().endsWith(".docx")
        ? dateiname.trim()
        : dateiname.trim() + ".docx"
      : vorlage.name.endsWith(".docx")
        ? vorlage.name
        : vorlage.name + ".docx";

    // Upload filled document to MinIO
    const timestamp = Date.now();
    const sanitized = outputName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
    const storageKey = `akten/${akteId}/dokumente/${timestamp}_${sanitized}`;
    await uploadFile(
      storageKey,
      filledBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filledBuffer.length
    );

    // Create document record
    const dokument = await prisma.dokument.create({
      data: {
        akteId,
        name: outputName,
        dateipfad: storageKey,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        groesse: filledBuffer.length,
        ordner: ordner || null,
        tags: tags || [],
        createdById: userId,
      },
    });

    // Audit log
    await logAuditEvent({
      userId,
      akteId,
      aktion: "DOKUMENT_HOCHGELADEN",
      details: {
        name: outputName,
        ausVorlage: vorlage.name,
        vorlageId: vorlage.id,
      },
    });

    // Index in Meilisearch (non-blocking)
    indexDokument({
      id: dokument.id,
      akteId,
      name: outputName,
      mimeType: dokument.mimeType,
      ordner: dokument.ordner,
      tags: dokument.tags,
      ocrText: null,
      createdById: userId,
      createdByName: session.user.name ?? "",
      aktenzeichen: akte.aktenzeichen,
      kurzrubrum: akte.kurzrubrum,
      createdAt: Math.floor(new Date(dokument.createdAt).getTime() / 1000),
    }).catch(() => {});

    return NextResponse.json({ dokument }, { status: 201 });
  } catch (err: any) {
    console.error("Template fill error:", err);
    return NextResponse.json(
      { error: err.message?.slice(0, 200) ?? "Fehler beim Erstellen des Dokuments aus Vorlage" },
      { status: 500 }
    );
  }
}
