import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDownloadUrl, uploadFile, getFileStream } from "@/lib/storage";
import { signPayload, ONLYOFFICE_INTERNAL_URL, rewriteOnlyOfficeUrl } from "@/lib/onlyoffice";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";

const APP_INTERNAL_URL =
  process.env.APP_INTERNAL_URL ?? "http://host.docker.internal:3000";

/**
 * POST /api/dokumente/[id]/pdf -- convert a document to PDF using ONLYOFFICE conversion API.
 *
 * Options in body JSON:
 *   - saveToAkte: boolean (default true) -- save the PDF as a new document in the same Akte
 *   - download: boolean (default false) -- return the PDF as a download response
 *
 * Returns: { pdfUrl, dokumentId? } or the PDF file stream if download=true
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;
  let body: { saveToAkte?: boolean; download?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const saveToAkte = body.saveToAkte !== false;
  const download = body.download === true;

  const dokument = await prisma.dokument.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true } },
    },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // RBAC: check access to the parent Akte
  const access = await requireAkteAccess(dokument.akte.id);
  if (access.error) return access.error;

  // Check if the document is already a PDF
  if (dokument.mimeType === "application/pdf") {
    if (download) {
      const stream = await getFileStream(dokument.dateipfad);
      if (!stream) {
        return NextResponse.json(
          { error: "Datei nicht gefunden" },
          { status: 404 }
        );
      }
      const webStream = stream.transformToWebStream();
      return new NextResponse(webStream as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(dokument.name)}"`,
        },
      });
    }
    const url = await getDownloadUrl(dokument.dateipfad);
    return NextResponse.json({ pdfUrl: url, dokumentId: dokument.id });
  }

  // Get the file extension
  const ext = dokument.name.split(".").pop()?.toLowerCase() ?? "";

  // Build the conversion request for ONLYOFFICE
  const documentUrl = `${APP_INTERNAL_URL}/api/onlyoffice/download/${dokument.id}`;
  const conversionPayload = {
    async: false,
    filetype: ext,
    key: `convert_${dokument.id}_${Date.now()}`,
    outputtype: "pdf",
    title: dokument.name.replace(/\.[^.]+$/, ".pdf"),
    url: documentUrl,
  };

  // Sign the conversion request
  const token = signPayload(conversionPayload);

  try {
    const conversionRes = await fetch(
      `${ONLYOFFICE_INTERNAL_URL}/ConvertService.ashx`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...conversionPayload, token }),
      }
    );

    if (!conversionRes.ok) {
      const errText = await conversionRes.text();
      console.error("[ONLYOFFICE] Conversion error:", errText);
      return NextResponse.json(
        {
          error: `PDF-Konvertierung fehlgeschlagen (${conversionRes.status})`,
        },
        { status: 502 }
      );
    }

    const conversionResult = await conversionRes.json();

    if (conversionResult.error) {
      console.error(
        "[ONLYOFFICE] Conversion error:",
        conversionResult.error
      );
      return NextResponse.json(
        { error: `PDF-Konvertierung fehlgeschlagen (Fehler ${conversionResult.error})` },
        { status: 502 }
      );
    }

    if (!conversionResult.fileUrl) {
      return NextResponse.json(
        { error: "PDF-Konvertierung hat keine Datei zurückgegeben" },
        { status: 502 }
      );
    }

    // Download the converted PDF from ONLYOFFICE
    // Rewrite URL so it's reachable from the app container (not localhost)
    const pdfFetchUrl = rewriteOnlyOfficeUrl(conversionResult.fileUrl);
    const pdfResponse = await fetch(pdfFetchUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Konvertierte PDF konnte nicht heruntergeladen werden" },
        { status: 502 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfName = dokument.name.replace(/\.[^.]+$/, ".pdf");

    // If download requested, return the PDF directly
    if (download && !saveToAkte) {
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(pdfName)}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // Save the PDF to MinIO and create a document record
    let pdfDokumentId: string | undefined;
    let pdfUrl: string | undefined;

    if (saveToAkte) {
      const timestamp = Date.now();
      const sanitized = pdfName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const storageKey = `akten/${dokument.akte.id}/dokumente/${timestamp}_${sanitized}`;

      await uploadFile(storageKey, pdfBuffer, "application/pdf", pdfBuffer.length);

      const pdfDokument = await prisma.dokument.create({
        data: {
          akteId: dokument.akte.id,
          name: pdfName,
          dateipfad: storageKey,
          mimeType: "application/pdf",
          groesse: pdfBuffer.length,
          ordner: dokument.ordner,
          tags: dokument.tags,
          createdById: session.user.id!,
        },
      });

      pdfDokumentId = pdfDokument.id;

      await logAuditEvent({
        userId: session.user.id!,
        akteId: dokument.akte.id,
        aktion: "DOKUMENT_HOCHGELADEN",
        details: {
          name: pdfName,
          konvertiertVon: dokument.name,
          quellDokumentId: dokument.id,
        },
      });

      pdfUrl = await getDownloadUrl(storageKey);
    }

    if (download) {
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(pdfName)}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json({
      pdfUrl,
      dokumentId: pdfDokumentId,
      name: pdfName,
    });
  } catch (err: any) {
    console.error("[ONLYOFFICE] PDF conversion error:", err);
    return NextResponse.json(
      {
        error:
          "PDF-Konvertierung fehlgeschlagen. Ist ONLYOFFICE DocumentServer gestartet?",
      },
      { status: 502 }
    );
  }
}
