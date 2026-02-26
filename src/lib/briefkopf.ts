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

// ─── DOCX Generator ─────────────────────────────────────────────────────────

/** Map image MIME type to file extension for DOCX media folder. */
function mimeToExt(mimeType: string): string | null {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
  };
  return map[mimeType.split(";")[0].toLowerCase().trim()] ?? null;
}

/** XML-escape a string for use in text content. */
function xmlEsc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Generate a minimal DOCX buffer with a styled header and footer,
 * built from structured Briefkopf fields.
 *
 * The generated DOCX can be passed directly to applyBriefkopfToDocx.
 *
 * Layout:
 *   Header: [Logo paragraph?] | KanzleiName (bold 14pt blue) | Adresse | Tel/Fax | Email/Web
 *   Footer: IBAN BIC Bank Steuernr [TAB→right] Seite {PAGE}
 *           [braoInfo line?]
 */
export function generateBriefkopfDocx(
  data: BriefkopfData,
  logoBuffer?: Buffer | null,
  logoMimeType?: string | null
): Buffer {
  const zip = new PizZip();

  const logoExt = logoMimeType ? mimeToExt(logoMimeType) : null;
  const hasLogo = !!(logoBuffer && logoExt);

  // ── [Content_Types].xml ─────────────────────────────────────────────────
  const logoDefaultEntry =
    hasLogo && logoExt
      ? `\n  <Default Extension="${logoExt}" ContentType="${(logoMimeType ?? "image/png").split(";")[0].trim()}"/>`
      : "";

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>${logoDefaultEntry}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  // ── _rels/.rels ──────────────────────────────────────────────────────────
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // ── word/document.xml ───────────────────────────────────────────────────
  // Minimal body: one empty paragraph + sectPr referencing header/footer
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:p>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/>
      <w:footerReference w:type="default" r:id="rId3"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // ── word/_rels/document.xml.rels ─────────────────────────────────────────
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  // ── word/styles.xml ──────────────────────────────────────────────────────
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Header">
    <w:name w:val="header"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Footer">
    <w:name w:val="footer"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;

  // ── word/header1.xml ─────────────────────────────────────────────────────
  const hdrParas: string[] = [];

  // Logo paragraph (inline drawing, 3cm × 1.5cm = 1080000 × 540000 EMU)
  if (hasLogo) {
    hdrParas.push(
      `<w:p>` +
        `<w:pPr><w:jc w:val="left"/></w:pPr>` +
        `<w:r><w:drawing>` +
        `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
        `<wp:extent cx="1080000" cy="540000"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="1" name="Logo"/>` +
        `<wp:cNvGraphicFramePr>` +
        `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
        `</wp:cNvGraphicFramePr>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr>` +
        `<pic:cNvPr id="1" name="Logo"/><pic:cNvPicPr/>` +
        `</pic:nvPicPr>` +
        `<pic:blipFill>` +
        `<a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
        `<a:stretch><a:fillRect/></a:stretch>` +
        `</pic:blipFill>` +
        `<pic:spPr>` +
        `<a:xfrm><a:off x="0" y="0"/><a:ext cx="1080000" cy="540000"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
        `</pic:spPr>` +
        `</pic:pic>` +
        `</a:graphicData>` +
        `</a:graphic>` +
        `</wp:inline>` +
        `</w:drawing></w:r>` +
        `</w:p>`
    );
  }

  // Kanzleiname — bold, 14pt (28 half-pt), brand blue #1D4ED8
  if (data.kanzleiName) {
    hdrParas.push(
      `<w:p>` +
        `<w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r><w:rPr><w:b/><w:color w:val="1D4ED8"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>` +
        `<w:t>${xmlEsc(data.kanzleiName)}</w:t></w:r>` +
        `</w:p>`
    );
  }

  // Adresse
  if (data.adresse) {
    hdrParas.push(
      `<w:p>` +
        `<w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
        `<w:t>${xmlEsc(data.adresse)}</w:t></w:r>` +
        `</w:p>`
    );
  }

  // Tel | Fax
  const telFaxLine = [
    data.telefon ? `Tel: ${data.telefon}` : null,
    data.fax ? `Fax: ${data.fax}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");
  if (telFaxLine) {
    hdrParas.push(
      `<w:p>` +
        `<w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
        `<w:t>${xmlEsc(telFaxLine)}</w:t></w:r>` +
        `</w:p>`
    );
  }

  // E-Mail | Web
  const emailWebLine = [
    data.email ? `E-Mail: ${data.email}` : null,
    data.website ? `Web: ${data.website}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");
  if (emailWebLine) {
    hdrParas.push(
      `<w:p>` +
        `<w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
        `<w:t>${xmlEsc(emailWebLine)}</w:t></w:r>` +
        `</w:p>`
    );
  }

  // Fallback: header must have at least one paragraph
  if (hdrParas.length === 0) {
    hdrParas.push(`<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p>`);
  }

  // Bottom border on the last header paragraph
  const borderAttr =
    `<w:pBdr>` +
    `<w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/>` +
    `</w:pBdr>`;
  const lastHdr = hdrParas[hdrParas.length - 1];
  hdrParas[hdrParas.length - 1] = lastHdr.includes("<w:pPr>")
    ? lastHdr.replace("<w:pPr>", `<w:pPr>${borderAttr}`)
    : lastHdr.replace("<w:p>", `<w:p><w:pPr>${borderAttr}</w:pPr>`);

  const headerXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"\n` +
    `       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n` +
    hdrParas.join("\n") +
    `\n</w:hdr>`;

  // ── word/footer1.xml ─────────────────────────────────────────────────────
  // Tab stop at right margin for page number (content width: 11906 - 1800 - 1440 = 8666 twips)
  const rightTabPos = 8666;
  const ftrParas: string[] = [];

  const leftFooter = [
    data.iban ? `IBAN: ${data.iban}` : null,
    data.bic ? `BIC: ${data.bic}` : null,
    data.bankName || null,
    data.steuernr ? `St.-Nr.: ${data.steuernr}` : null,
    data.ustIdNr ? `USt-IdNr: ${data.ustIdNr}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  // Page-number field runs (begin / instrText / separate / cached "1" / end)
  const pageField =
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>1</w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;

  ftrParas.push(
    `<w:p>` +
      `<w:pPr>` +
      `<w:pStyle w:val="Footer"/>` +
      `<w:tabs><w:tab w:val="right" w:pos="${rightTabPos}"/></w:tabs>` +
      `</w:pPr>` +
      (leftFooter
        ? `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>` +
          `<w:t xml:space="preserve">${xmlEsc(leftFooter)}</w:t></w:r>` +
          `<w:r><w:tab/></w:r>`
        : `<w:r><w:tab/></w:r>`) +
      `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>` +
      `<w:t xml:space="preserve">Seite </w:t></w:r>` +
      pageField +
      `</w:p>`
  );

  // Optional braoInfo line (7pt = 14 half-pt)
  if (data.braoInfo) {
    ftrParas.push(
      `<w:p>` +
        `<w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="left"/></w:pPr>` +
        `<w:r><w:rPr><w:sz w:val="14"/><w:szCs w:val="14"/></w:rPr>` +
        `<w:t>${xmlEsc(data.braoInfo)}</w:t></w:r>` +
        `</w:p>`
    );
  }

  const footerXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"\n` +
    `       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n` +
    ftrParas.join("\n") +
    `\n</w:ftr>`;

  // ── Assemble ZIP ─────────────────────────────────────────────────────────
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rootRels);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", documentRels);
  zip.file("word/styles.xml", stylesXml);
  zip.file("word/header1.xml", headerXml);
  zip.file("word/footer1.xml", footerXml);

  if (hasLogo && logoBuffer) {
    zip.file(`word/media/logo.${logoExt}`, logoBuffer);
    zip.file(
      "word/_rels/header1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
        `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.${logoExt}"/>\n` +
        `</Relationships>`
    );
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

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
