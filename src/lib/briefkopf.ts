/**
 * Briefkopf (letterhead) management library.
 *
 * Handles DOCX header/footer manipulation for applying law firm letterhead
 * to generated documents, and PDF export via OnlyOffice Conversion API.
 *
 * Strategy: Copies header/footer XML parts, media, and relationships from
 * the Briefkopf DOCX into the target DOCX. If the Briefkopf has
 * first-page-different headers, they are preserved (full letterhead on
 * first page, minimal on subsequent pages).
 */

import PizZip from "pizzip";
import {
  ONLYOFFICE_INTERNAL_URL,
  signPayload,
  rewriteOnlyOfficeUrl,
} from "@/lib/onlyoffice";

const APP_INTERNAL_URL =
  process.env.APP_INTERNAL_URL ?? "http://host.docker.internal:3000";
const ONLYOFFICE_SECRET = process.env.ONLYOFFICE_SECRET ?? "";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BriefkopfData {
  kanzleiName?: string | null;
  adresse?: string | null;
  telefon?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  steuernr?: string | null;
  ustIdNr?: string | null;
  iban?: string | null;
  bic?: string | null;
  bankName?: string | null;
  braoInfo?: string | null;
}

// ─── DOCX Header/Footer Manipulation ────────────────────────────────────────

/**
 * Apply a Briefkopf (letterhead) to a target DOCX document.
 *
 * Copies header/footer XML parts and their referenced media (images/logos)
 * from the Briefkopf DOCX into the target DOCX. Updates relationships and
 * content types accordingly.
 *
 * If the Briefkopf DOCX has a first-page-different header setting,
 * it will be preserved (full letterhead on first page, minimal on subsequent).
 *
 * @param targetBuffer - The filled template DOCX
 * @param briefkopfBuffer - The Briefkopf DOCX containing headers/footers
 * @returns Merged DOCX buffer with letterhead applied
 */
export function applyBriefkopfToDocx(
  targetBuffer: Buffer,
  briefkopfBuffer: Buffer
): Buffer {
  const targetZip = new PizZip(targetBuffer);
  const briefkopfZip = new PizZip(briefkopfBuffer);

  // 1. Find all header/footer parts in the Briefkopf using filter()
  const headerFooterFiles = briefkopfZip.filter(
    (relativePath: string, file: { dir: boolean }) => {
      return (
        /^word\/(header|footer)\d*\.xml$/.test(relativePath) && !file.dir
      );
    }
  );

  const headerFooterParts = headerFooterFiles.map(
    (f: { name: string }) => f.name
  );

  if (headerFooterParts.length === 0) {
    // No headers/footers in Briefkopf - return target unchanged
    return targetBuffer;
  }

  // 2. Copy header/footer XML files from Briefkopf to target
  for (const part of headerFooterParts) {
    const content = briefkopfZip.file(part)?.asText();
    if (content) {
      targetZip.file(part, content);
    }
  }

  // 3. Copy media files (images/logos) from Briefkopf
  const mediaFiles = briefkopfZip.filter(
    (relativePath: string, file: { dir: boolean }) => {
      return relativePath.startsWith("word/media/") && !file.dir;
    }
  );
  for (const mediaFile of mediaFiles) {
    const data = briefkopfZip.file(mediaFile.name)?.asUint8Array();
    if (data) {
      targetZip.file(mediaFile.name, data);
    }
  }

  // 4. Copy header/footer relationship files from Briefkopf
  for (const part of headerFooterParts) {
    const relPath = part.replace("word/", "word/_rels/") + ".rels";
    const relContent = briefkopfZip.file(relPath)?.asText();
    if (relContent) {
      targetZip.file(relPath, relContent);
    }
  }

  // 5. Update document.xml.rels to include header/footer relationships
  const briefkopfDocRels = briefkopfZip
    .file("word/_rels/document.xml.rels")
    ?.asText();
  const targetDocRels = targetZip
    .file("word/_rels/document.xml.rels")
    ?.asText();

  if (briefkopfDocRels && targetDocRels) {
    // Extract header/footer relationships from Briefkopf
    const hfRelRegex =
      /<Relationship[^>]*Type="[^"]*\/(header|footer)"[^>]*\/>/g;
    const hfRels: string[] = [];
    let relMatch;
    while ((relMatch = hfRelRegex.exec(briefkopfDocRels)) !== null) {
      hfRels.push(relMatch[0]);
    }

    if (hfRels.length > 0) {
      // Remove any existing header/footer relationships from target
      let updatedRels = targetDocRels.replace(
        /<Relationship[^>]*Type="[^"]*\/(header|footer)"[^>]*\/>/g,
        ""
      );

      // Insert new header/footer relationships before closing tag
      const insertPoint = updatedRels.lastIndexOf("</Relationships>");
      if (insertPoint !== -1) {
        updatedRels =
          updatedRels.slice(0, insertPoint) +
          hfRels.join("\n") +
          "\n" +
          updatedRels.slice(insertPoint);
      }

      targetZip.file("word/_rels/document.xml.rels", updatedRels);
    }
  }

  // 6. Update sectPr in document.xml to reference headers/footers from Briefkopf
  const briefkopfDocXml = briefkopfZip.file("word/document.xml")?.asText();
  const targetDocXml = targetZip.file("word/document.xml")?.asText();

  if (briefkopfDocXml && targetDocXml) {
    // Extract sectPr (section properties) from Briefkopf with headerReference/footerReference
    const sectPrRegex = /<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/;
    const briefkopfSectPr = briefkopfDocXml.match(sectPrRegex);

    if (briefkopfSectPr) {
      const targetSectPr = targetDocXml.match(sectPrRegex);
      if (targetSectPr) {
        // Preserve page size and margins from target, use header/footer refs from Briefkopf
        const pgSzMatch = targetDocXml.match(/<w:pgSz[^/]*\/>/);
        const pgMarMatch = targetDocXml.match(/<w:pgMar[^/]*\/>/);

        let mergedSectPr = briefkopfSectPr[0];
        if (pgSzMatch) {
          mergedSectPr = mergedSectPr.replace(/<w:pgSz[^/]*\/>/, pgSzMatch[0]);
        }
        if (pgMarMatch) {
          mergedSectPr = mergedSectPr.replace(
            /<w:pgMar[^/]*\/>/,
            pgMarMatch[0]
          );
        }

        const updatedDocXml = targetDocXml.replace(sectPrRegex, mergedSectPr);
        targetZip.file("word/document.xml", updatedDocXml);
      }
    }
  }

  // 7. Update [Content_Types].xml for any new media types
  const targetContentTypes = targetZip.file("[Content_Types].xml")?.asText();
  const briefkopfContentTypes = briefkopfZip
    .file("[Content_Types].xml")
    ?.asText();

  if (targetContentTypes && briefkopfContentTypes) {
    let updatedContentTypes = targetContentTypes;

    // Ensure media type extensions are registered (png, jpeg, gif, etc.)
    const defaultExtRegex =
      /<Default Extension="([^"]+)" ContentType="([^"]+)"\/>/g;
    let extMatch;
    const existingExts = new Set<string>();
    while ((extMatch = defaultExtRegex.exec(targetContentTypes)) !== null) {
      existingExts.add(extMatch[1].toLowerCase());
    }

    const defaultExtRegex2 =
      /<Default Extension="([^"]+)" ContentType="([^"]+)"\/>/g;
    const newDefaults: string[] = [];
    while (
      (extMatch = defaultExtRegex2.exec(briefkopfContentTypes)) !== null
    ) {
      if (!existingExts.has(extMatch[1].toLowerCase())) {
        newDefaults.push(extMatch[0]);
        existingExts.add(extMatch[1].toLowerCase());
      }
    }

    // Add header/footer overrides if missing
    const overrideRegex =
      /<Override PartName="\/word\/(header|footer)\d+\.xml"[^/]*\/>/g;
    const existingOverrides = new Set<string>();
    let ovMatch;
    while ((ovMatch = overrideRegex.exec(targetContentTypes)) !== null) {
      existingOverrides.add(ovMatch[0]);
    }

    const briefkopfOverrides: string[] = [];
    const briefkopfOverrideRegex =
      /<Override PartName="\/word\/(header|footer)\d+\.xml"[^/]*\/>/g;
    while (
      (ovMatch = briefkopfOverrideRegex.exec(briefkopfContentTypes)) !== null
    ) {
      if (!existingOverrides.has(ovMatch[0])) {
        briefkopfOverrides.push(ovMatch[0]);
      }
    }

    if (newDefaults.length > 0 || briefkopfOverrides.length > 0) {
      const insertPoint = updatedContentTypes.lastIndexOf("</Types>");
      if (insertPoint !== -1) {
        updatedContentTypes =
          updatedContentTypes.slice(0, insertPoint) +
          newDefaults.join("\n") +
          briefkopfOverrides.join("\n") +
          "\n" +
          updatedContentTypes.slice(insertPoint);
      }
    }

    targetZip.file("[Content_Types].xml", updatedContentTypes);
  }

  return targetZip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}

// ─── PDF Conversion ─────────────────────────────────────────────────────────

/**
 * Convert a document to PDF via the OnlyOffice Conversion API.
 *
 * @param dokumentId - The document ID (used to build the download URL)
 * @param fileName - The document filename (for file type detection)
 * @returns PDF buffer
 */
export async function convertToPdf(
  dokumentId: string,
  fileName: string
): Promise<Buffer> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "docx";

  // Build download URL accessible from OnlyOffice Docker container
  const downloadUrl = `${APP_INTERNAL_URL}/api/onlyoffice/download/${dokumentId}`;

  // Build conversion request payload
  const conversionPayload: Record<string, unknown> = {
    filetype: ext,
    key: `convert_pdf_${dokumentId}_${Date.now()}`,
    outputtype: "pdf",
    title: fileName,
    url: downloadUrl,
  };

  // Sign payload with JWT if OnlyOffice JWT is enabled
  if (ONLYOFFICE_SECRET) {
    try {
      conversionPayload.token = signPayload(conversionPayload);
    } catch (err) {
      console.error("[Briefkopf/ConvertToPdf] Failed to sign payload:", err);
    }
  }

  const converterUrl = `${ONLYOFFICE_INTERNAL_URL}/ConvertService.ashx`;

  let fileUrl: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const response = await fetch(converterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(conversionPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OnlyOffice conversion failed (${response.status}): ${errorText}`
      );
    }

    const result: { endConvert: boolean; fileUrl?: string } =
      await response.json();

    if (result.endConvert && result.fileUrl) {
      fileUrl = rewriteOnlyOfficeUrl(result.fileUrl);
      break;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!fileUrl) {
    throw new Error("OnlyOffice conversion timed out");
  }

  // Download the converted PDF
  const pdfResponse = await fetch(fileUrl);
  if (!pdfResponse.ok) {
    throw new Error(
      `Failed to download converted PDF: ${pdfResponse.status}`
    );
  }

  const arrayBuffer = await pdfResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convert a DOCX buffer directly to PDF using a provided download URL.
 * For cases where the buffer is already accessible at a URL (e.g. after upload to MinIO).
 *
 * @param downloadUrl - URL where OnlyOffice can download the DOCX
 * @returns PDF buffer
 */
export async function convertBufferToPdf(
  downloadUrl: string
): Promise<Buffer> {
  const conversionPayload: Record<string, unknown> = {
    filetype: "docx",
    key: `convert_buffer_${Date.now()}`,
    outputtype: "pdf",
    title: "document.docx",
    url: downloadUrl,
  };

  if (ONLYOFFICE_SECRET) {
    try {
      conversionPayload.token = signPayload(conversionPayload);
    } catch (err) {
      console.error("[Briefkopf/ConvertBufferToPdf] Failed to sign:", err);
    }
  }

  const converterUrl = `${ONLYOFFICE_INTERNAL_URL}/ConvertService.ashx`;

  let fileUrl: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const response = await fetch(converterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(conversionPayload),
    });

    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.status}`);
    }

    const result: { endConvert: boolean; fileUrl?: string } =
      await response.json();
    if (result.endConvert && result.fileUrl) {
      fileUrl = rewriteOnlyOfficeUrl(result.fileUrl);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!fileUrl) {
    throw new Error("Conversion timed out");
  }

  const pdfResponse = await fetch(fileUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
  }

  return Buffer.from(await pdfResponse.arrayBuffer());
}
