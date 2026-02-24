import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileStream, uploadFile } from "@/lib/storage";
import { resolvePlatzhalter, fillDocxTemplate } from "@/lib/vorlagen";
import { applyBriefkopfToDocx } from "@/lib/briefkopf";
import { buildEditorConfig } from "@/lib/onlyoffice";

/**
 * POST /api/vorlagen/[id]/generieren -- generate a document from a template
 *
 * Body: {
 *   akteId: string,
 *   customFelderValues?: Record<string, string>,
 *   briefkopfId?: string,        // Use specific Briefkopf (or default)
 *   openInEditor?: boolean,      // Return OnlyOffice editor config
 *   targetOrdner?: string,       // Virtual folder in Akte
 *   dateiname?: string           // Custom filename (overrides auto-generated)
 * }
 *
 * Steps:
 * 1. Load template DOCX from MinIO
 * 2. Load Akte with all Beteiligte, Anwalt, Kanzlei data
 * 3. Resolve placeholders from case data
 * 4. Merge custom field values
 * 5. Fill template
 * 6. Apply Briefkopf if available
 * 7. Generate filename
 * 8. Upload to MinIO
 * 9. Create Dokument record
 * 10. Return Dokument (+ editor config if requested)
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

  let body: {
    akteId?: string;
    customFelderValues?: Record<string, string>;
    briefkopfId?: string;
    openInEditor?: boolean;
    targetOrdner?: string;
    dateiname?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { akteId, customFelderValues, briefkopfId, openInEditor, targetOrdner, dateiname } = body;

  if (!akteId) {
    return NextResponse.json(
      { error: "akteId ist erforderlich" },
      { status: 400 }
    );
  }

  // 1. Load template
  const vorlage = await prisma.dokumentVorlage.findUnique({ where: { id } });
  if (!vorlage) {
    return NextResponse.json(
      { error: "Vorlage nicht gefunden" },
      { status: 404 }
    );
  }

  // 2. Load Akte with all related data
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
    return NextResponse.json(
      { error: "Akte nicht gefunden" },
      { status: 404 }
    );
  }

  try {
    // 1. Load template DOCX from MinIO
    const templateStream = await getFileStream(vorlage.dateipfad);
    if (!templateStream) {
      return NextResponse.json(
        { error: "Vorlagendatei nicht in MinIO gefunden" },
        { status: 500 }
      );
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = (templateStream as ReadableStream).getReader
      ? (templateStream as ReadableStream).getReader()
      : null;

    if (reader) {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) chunks.push(result.value);
      }
    } else {
      // Node.js Readable stream
      for await (const chunk of templateStream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    }
    const templateBuffer = Buffer.concat(chunks);

    // 3. Resolve placeholders from case data
    const akteData = {
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
    };

    const placeholderData = resolvePlatzhalter(akteData);

    // 5. Fill template with data + custom field values
    let filledBuffer = fillDocxTemplate(
      templateBuffer,
      placeholderData,
      customFelderValues
    );

    // 6. Apply Briefkopf if available
    let briefkopf = null;
    if (briefkopfId) {
      briefkopf = await prisma.briefkopf.findUnique({
        where: { id: briefkopfId },
      });
    }
    if (!briefkopf) {
      // Try to load default Briefkopf
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
        console.error("[Generation] Briefkopf apply failed:", err);
        // Continue without Briefkopf rather than failing
      }
    }

    // 7. Generate filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    // Find Mandant name for filename
    const mandant = akte.beteiligte.find((b) => b.rolle === "MANDANT");
    const mandantName = mandant?.kontakt?.nachname ?? "Unbekannt";
    const autoName = `${akte.aktenzeichen}_${vorlage.kategorie}_${mandantName}_${dateStr}.docx`
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const fileName = dateiname
      ? dateiname.endsWith(".docx")
        ? dateiname
        : `${dateiname}.docx`
      : autoName;

    // 8. Upload to MinIO in the Akte's folder
    const folder = targetOrdner ?? suggestOrdner(vorlage.kategorie);
    const storageKey = `akten/${akteId}/dokumente/${folder ? folder + "/" : ""}${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await uploadFile(
      storageKey,
      filledBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filledBuffer.length
    );

    // 9. Create Dokument record
    const dokument = await prisma.dokument.create({
      data: {
        akteId: akte.id,
        name: fileName,
        dateipfad: storageKey,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        groesse: filledBuffer.length,
        ordner: folder || null,
        status: "ENTWURF",
        erstelltDurch: "system",
        createdById: session.user.id!,
      },
    });

    // 10. Build response
    const response: any = { dokument };

    if (openInEditor) {
      // Return OnlyOffice editor config for immediate editing
      const editorConfig = buildEditorConfig({
        dokumentId: dokument.id,
        fileName: dokument.name,
        mimeType: dokument.mimeType,
        userId: session.user.id!,
        userName: session.user.name ?? "Unbekannt",
        version: dokument.version,
        dokumentStatus: dokument.status,
        mode: "edit",
      });
      response.editorConfig = editorConfig;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (err: any) {
    console.error("[Generation] Error:", err);
    return NextResponse.json(
      {
        error:
          err.message?.slice(0, 200) ??
          "Fehler bei der Dokumentgenerierung",
      },
      { status: 500 }
    );
  }
}

/**
 * Suggest a target folder based on template category.
 */
function suggestOrdner(kategorie: string): string {
  const mapping: Record<string, string> = {
    SCHRIFTSATZ: "Schriftsaetze",
    KLAGE: "Schriftsaetze",
    MANDATSVOLLMACHT: "Vollmachten",
    MAHNUNG: "Mahnungen",
    VERTRAG: "Vertraege",
    BRIEF: "Korrespondenz",
    BESCHEID: "Bescheide",
    SONSTIGES: "Sonstiges",
  };
  return mapping[kategorie] ?? "Sonstiges";
}
