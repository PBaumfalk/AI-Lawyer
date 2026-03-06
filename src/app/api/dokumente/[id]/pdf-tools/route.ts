import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileStream, uploadFile, generateStorageKey } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requireAkteAccess } from "@/lib/rbac";
import {
  splitPdf,
  rotatePdf,
  compressPdf,
  addWatermark,
  autoRedact,
  buildDsgvoPiiPattern,
} from "@/lib/pdf/stirling-pdf-tools";
import type { PdfToolOperation } from "@/lib/pdf/stirling-pdf-tools";

// ─── Request body type ───────────────────────────────────────────────────────

interface PdfToolRequest {
  operation: Exclude<PdfToolOperation, "merge">;
  // Split
  pages?: string;
  // Rotate
  angle?: 90 | 180 | 270;
  // Compress
  level?: 1 | 2 | 3 | 4 | 5;
  // Watermark
  text?: string;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
  // Redact
  redactPatterns?: string[];
  useDsgvo?: boolean;
  // Save behavior
  saveAsNew?: boolean;
}

// ─── Operation name suffixes for generated filenames ─────────────────────────

const OPERATION_SUFFIXES: Record<string, string> = {
  split: "geteilt",
  rotate: "gedreht",
  compress: "komprimiert",
  watermark: "wasserzeichen",
  redact: "geschwaerzt",
};

/**
 * POST /api/dokumente/[id]/pdf-tools
 *
 * Apply a PDF tool operation (split, rotate, compress, watermark, redact)
 * to a single document. Downloads from MinIO, processes via Stirling-PDF,
 * and saves result back.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  // Parse request body
  let body: PdfToolRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger JSON-Body" },
      { status: 400 }
    );
  }

  // Validate operation
  const validOps: PdfToolRequest["operation"][] = [
    "split",
    "rotate",
    "compress",
    "watermark",
    "redact",
  ];
  if (!body.operation || !validOps.includes(body.operation)) {
    return NextResponse.json(
      {
        error: `Ungueltige Operation. Erlaubt: ${validOps.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Load document
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

  // Verify document is a PDF
  if (dokument.mimeType !== "application/pdf") {
    return NextResponse.json(
      { error: "Nur PDF-Dokumente koennen bearbeitet werden" },
      { status: 400 }
    );
  }

  // Download PDF from MinIO
  const stream = await getFileStream(dokument.dateipfad);
  if (!stream) {
    return NextResponse.json(
      { error: "Datei nicht im Speicher gefunden" },
      { status: 404 }
    );
  }

  // Convert stream to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const pdfBuffer = Buffer.concat(chunks);

  // Execute the requested operation
  let resultBuffer: Buffer;
  try {
    switch (body.operation) {
      case "split": {
        if (!body.pages) {
          return NextResponse.json(
            { error: "Seitenbereiche (pages) muessen angegeben werden" },
            { status: 400 }
          );
        }
        resultBuffer = await splitPdf(pdfBuffer, body.pages);
        break;
      }
      case "rotate": {
        const angle = body.angle ?? 90;
        if (![90, 180, 270].includes(angle)) {
          return NextResponse.json(
            { error: "Winkel muss 90, 180 oder 270 sein" },
            { status: 400 }
          );
        }
        resultBuffer = await rotatePdf(pdfBuffer, angle as 90 | 180 | 270);
        break;
      }
      case "compress": {
        const level = body.level ?? 3;
        if (level < 1 || level > 5) {
          return NextResponse.json(
            { error: "Komprimierungsstufe muss zwischen 1 und 5 liegen" },
            { status: 400 }
          );
        }
        resultBuffer = await compressPdf(pdfBuffer, level as 1 | 2 | 3 | 4 | 5);
        break;
      }
      case "watermark": {
        if (!body.text) {
          return NextResponse.json(
            { error: "Wasserzeichen-Text (text) muss angegeben werden" },
            { status: 400 }
          );
        }
        resultBuffer = await addWatermark(
          pdfBuffer,
          body.text,
          body.fontSize,
          body.rotation,
          body.opacity
        );
        break;
      }
      case "redact": {
        let searchText: string;
        let useRegex = false;

        if (body.useDsgvo) {
          // Build combined DSGVO PII regex
          searchText = buildDsgvoPiiPattern();
          useRegex = true;
        } else if (body.redactPatterns && body.redactPatterns.length > 0) {
          searchText = body.redactPatterns
            .map((p) => `(${p})`)
            .join("|");
          useRegex = true;
        } else {
          return NextResponse.json(
            {
              error:
                "Schwärzungsmuster (redactPatterns) oder useDsgvo muessen angegeben werden",
            },
            { status: 400 }
          );
        }
        resultBuffer = await autoRedact(pdfBuffer, searchText, useRegex);
        break;
      }
      default:
        return NextResponse.json(
          { error: "Unbekannte Operation" },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error(`[PDF-TOOLS] ${body.operation} fehlgeschlagen:`, err);
    return NextResponse.json(
      {
        error: `PDF-Operation '${body.operation}' fehlgeschlagen: ${err.message ?? "Stirling-PDF nicht erreichbar"}`,
      },
      { status: 502 }
    );
  }

  // Save result
  const saveAsNew = body.saveAsNew !== false; // default true
  const suffix = OPERATION_SUFFIXES[body.operation] ?? body.operation;
  const baseName = dokument.name.replace(/\.pdf$/i, "");

  try {
    if (saveAsNew) {
      // Create new document
      const newName = `${baseName}_${suffix}.pdf`;
      const storageKey = generateStorageKey(dokument.akte.id, newName);

      await uploadFile(storageKey, resultBuffer, "application/pdf", resultBuffer.length);

      const newDokument = await prisma.dokument.create({
        data: {
          akteId: dokument.akte.id,
          name: newName,
          dateipfad: storageKey,
          mimeType: "application/pdf",
          groesse: resultBuffer.length,
          ordner: dokument.ordner,
          tags: dokument.tags,
          createdById: session.user.id,
        },
      });

      await logAuditEvent({
        userId: session.user.id,
        akteId: dokument.akte.id,
        aktion: "DOKUMENT_HOCHGELADEN",
        details: {
          name: newName,
          operation: body.operation,
          quellDokumentId: dokument.id,
          quellDokumentName: dokument.name,
        },
      });

      return NextResponse.json({
        success: true,
        dokumentId: newDokument.id,
        name: newDokument.name,
        groesse: newDokument.groesse,
      });
    } else {
      // Overwrite existing document
      await uploadFile(dokument.dateipfad, resultBuffer, "application/pdf", resultBuffer.length);

      await prisma.dokument.update({
        where: { id: dokument.id },
        data: { groesse: resultBuffer.length },
      });

      await logAuditEvent({
        userId: session.user.id,
        akteId: dokument.akte.id,
        aktion: "DOKUMENT_AKTUALISIERT" as any,
        details: {
          name: dokument.name,
          operation: body.operation,
          neueGroesse: resultBuffer.length,
        },
      });

      return NextResponse.json({
        success: true,
        dokumentId: dokument.id,
        name: dokument.name,
        groesse: resultBuffer.length,
      });
    }
  } catch (err: any) {
    console.error("[PDF-TOOLS] Speichern fehlgeschlagen:", err);
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }
}
