import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ONLYOFFICE_INTERNAL_URL,
  signPayload,
  rewriteOnlyOfficeUrl,
} from "@/lib/onlyoffice";

const APP_INTERNAL_URL =
  process.env.APP_INTERNAL_URL ?? "http://host.docker.internal:3000";
const ONLYOFFICE_SECRET = process.env.ONLYOFFICE_SECRET ?? "";

/**
 * POST /api/onlyoffice/convert -- Convert document via OnlyOffice Conversion API.
 * Body: { dokumentId: string, outputType?: 'pdf' | 'docx' | 'odt' }
 * Default outputType: 'pdf'
 *
 * Returns the converted file as a binary response with appropriate Content-Type
 * and Content-Disposition headers for download.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  let body: { dokumentId?: string; outputType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { dokumentId, outputType = "pdf" } = body;

  if (!dokumentId) {
    return NextResponse.json(
      { error: "dokumentId ist erforderlich" },
      { status: 400 }
    );
  }

  const validOutputTypes = ["pdf", "docx", "odt"];
  if (!validOutputTypes.includes(outputType)) {
    return NextResponse.json(
      {
        error: `Ungueltiger outputType. Erlaubt: ${validOutputTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  // Determine source file type from filename
  const ext = dokument.name.split(".").pop()?.toLowerCase() ?? "docx";

  // Build download URL accessible from OnlyOffice Docker container
  const downloadUrl = `${APP_INTERNAL_URL}/api/onlyoffice/download/${dokumentId}`;

  // Build conversion request payload
  const conversionPayload: Record<string, unknown> = {
    filetype: ext,
    key: `convert_${dokumentId}_${Date.now()}`,
    outputtype: outputType,
    title: dokument.name,
    url: downloadUrl,
  };

  // Sign payload with JWT if OnlyOffice JWT is enabled
  if (ONLYOFFICE_SECRET) {
    try {
      conversionPayload.token = signPayload(conversionPayload);
    } catch (err) {
      console.error("[Conversion] Failed to sign payload:", err);
    }
  }

  try {
    // Call OnlyOffice Conversion API
    const converterUrl = `${ONLYOFFICE_INTERNAL_URL}/ConvertService.ashx`;
    console.log(
      `[Conversion] Converting ${dokument.name} (${ext} -> ${outputType}), url=${converterUrl}`
    );

    let conversionResult: { endConvert: boolean; fileUrl?: string } | null =
      null;
    let attempts = 0;
    const maxAttempts = 10;

    // Poll for completion if async conversion
    while (attempts < maxAttempts) {
      attempts++;

      const convResponse = await fetch(converterUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(conversionPayload),
      });

      if (!convResponse.ok) {
        const errorText = await convResponse.text();
        console.error(
          `[Conversion] API error ${convResponse.status}: ${errorText}`
        );
        return NextResponse.json(
          { error: `Konvertierung fehlgeschlagen: ${convResponse.status}` },
          { status: 502 }
        );
      }

      conversionResult = await convResponse.json();

      if (conversionResult?.endConvert && conversionResult.fileUrl) {
        break;
      }

      if (!conversionResult?.endConvert) {
        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!conversionResult?.fileUrl) {
      return NextResponse.json(
        { error: "Konvertierung hat kein Ergebnis geliefert" },
        { status: 502 }
      );
    }

    // Rewrite the file URL (OnlyOffice returns internal Docker URLs)
    const fileUrl = rewriteOnlyOfficeUrl(conversionResult.fileUrl);
    console.log(
      `[Conversion] Result URL: original=${conversionResult.fileUrl}, rewritten=${fileUrl}`
    );

    // Download the converted file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.error(
        `[Conversion] Failed to download converted file: ${fileResponse.status}`
      );
      return NextResponse.json(
        { error: "Konvertierte Datei konnte nicht heruntergeladen werden" },
        { status: 502 }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();

    // Determine content type for response
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      odt: "application/vnd.oasis.opendocument.text",
    };

    // Build output filename
    const baseName = dokument.name.replace(/\.[^.]+$/, "");
    const outputFilename = `${baseName}.${outputType}`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeMap[outputType] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFilename)}"`,
        "Content-Length": String(fileBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[Conversion] Unexpected error:", err);
    return NextResponse.json(
      { error: "Konvertierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
