/**
 * Local, in-memory conversion of incoming files to Markdown.
 *
 * Nothing is written to disk and nothing leaves the process here: DOCX/ODT are
 * unzipped with pizzip and walked with fast-xml-parser, PDFs go through
 * pdf-parse, scans/images go to a pluggable on-premises OCR provider.
 */

import PizZip from "pizzip";
import { XMLParser } from "fast-xml-parser";
import type {
  EingabeFormat,
  EingangsDatei,
  KonvertierungsErgebnis,
  OcrProvider,
} from "./types";
import { PipelineFehler } from "./types";

export const MAX_DATEI_BYTES = 25 * 1024 * 1024;
const MAX_ENTPACKT_BYTES = 80 * 1024 * 1024;
/** Below this many characters per PDF page we treat the PDF as a scan. */
const MIN_ZEICHEN_PRO_SEITE = 25;

// ---------------------------------------------------------------------------
// Format detection (magic bytes win over extension and declared MIME)
// ---------------------------------------------------------------------------

export function erkenneFormat(datei: EingangsDatei): EingabeFormat {
  const b = datei.daten;
  const ext = (datei.dateiname.split(".").pop() ?? "").toLowerCase();

  if (b.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG") return "bild";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "bild";
  const tiff = b.subarray(0, 4).toString("hex");
  if (tiff === "49492a00" || tiff === "4d4d002a") return "bild";
  if (b.subarray(0, 5).toString("latin1") === "{\\rtf") return "rtf";

  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    let zip: PizZip;
    try {
      zip = new PizZip(b);
    } catch {
      throw new PipelineFehler("konvertieren", "DATEI_DEFEKT", "ZIP-Container nicht lesbar");
    }
    if (zip.file("word/document.xml")) return "docx";
    const mt = zip.file("mimetype")?.asText().trim();
    if (mt === "application/vnd.oasis.opendocument.text") return "odt";
    throw new PipelineFehler(
      "konvertieren",
      "FORMAT_NICHT_UNTERSTUETZT",
      "Office-Format wird nicht unterstützt (nur DOCX und ODT-Text)",
    );
  }

  // Binary data we do not know is rejected rather than guessed.
  if (siehtBinaerAus(b)) {
    throw new PipelineFehler("konvertieren", "FORMAT_NICHT_UNTERSTUETZT", "Unbekanntes Binärformat");
  }

  switch (ext) {
    case "md":
    case "markdown":
      return "md";
    case "csv":
      return "csv";
    case "htm":
    case "html":
      return "html";
    case "eml":
      return "eml";
    default:
      if (/^\s*<(!doctype html|html)/i.test(b.subarray(0, 200).toString("utf8"))) return "html";
      return "txt";
  }
}

function siehtBinaerAus(b: Buffer): boolean {
  const probe = b.subarray(0, 4096);
  let steuer = 0;
  for (const byte of probe) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) steuer++;
  }
  return probe.length > 0 && steuer / probe.length > 0.1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function zuMarkdown(
  datei: EingangsDatei,
  optionen: { ocr?: OcrProvider } = {},
): Promise<KonvertierungsErgebnis> {
  if (datei.daten.length === 0) {
    throw new PipelineFehler("einlesen", "DATEI_LEER", "Die Datei ist leer");
  }
  if (datei.daten.length > MAX_DATEI_BYTES) {
    throw new PipelineFehler("einlesen", "DATEI_ZU_GROSS", "Die Datei überschreitet 25 MB");
  }

  const format = erkenneFormat(datei);
  const hinweise: string[] = [];
  let markdown: string;
  let ocr = false;

  switch (format) {
    case "txt":
    case "md":
      markdown = dekodiereText(datei.daten);
      break;
    case "csv":
      markdown = csvZuMarkdown(dekodiereText(datei.daten));
      break;
    case "html":
      markdown = htmlZuMarkdown(dekodiereText(datei.daten));
      break;
    case "rtf":
      markdown = rtfZuText(datei.daten.toString("latin1"));
      break;
    case "eml":
      markdown = emlZuMarkdown(datei.daten.toString("latin1"), hinweise);
      break;
    case "docx":
      markdown = docxZuMarkdown(datei.daten, hinweise);
      break;
    case "odt":
      markdown = odtZuMarkdown(datei.daten, hinweise);
      break;
    case "pdf": {
      const { text, seiten } = await pdfText(datei.daten);
      if (text.replace(/\s/g, "").length < MIN_ZEICHEN_PRO_SEITE * Math.max(1, seiten)) {
        markdown = await ocrOderFehler(datei.daten, "pdf", optionen.ocr);
        ocr = true;
        hinweise.push("PDF ohne Textebene, Text per lokaler OCR erkannt");
      } else {
        markdown = text;
      }
      break;
    }
    case "bild":
      markdown = await ocrOderFehler(datei.daten, "bild", optionen.ocr);
      ocr = true;
      hinweise.push("Bild, Text per lokaler OCR erkannt");
      break;
  }

  markdown = normalisiere(markdown);
  if (markdown.trim().length === 0) {
    throw new PipelineFehler("konvertieren", "KEIN_TEXT", "Aus der Datei ließ sich kein Text gewinnen");
  }
  return { format, markdown, ocr, hinweise };
}

async function ocrOderFehler(
  daten: Buffer,
  art: "pdf" | "bild",
  ocr: OcrProvider | undefined,
): Promise<string> {
  if (!ocr) {
    throw new PipelineFehler(
      "konvertieren",
      "OCR_ERFORDERLICH",
      "Die Datei braucht Texterkennung, aber kein lokaler OCR-Dienst ist eingerichtet",
    );
  }
  try {
    return await ocr.texterkennung(daten, art);
  } catch {
    throw new PipelineFehler("konvertieren", "OCR_FEHLGESCHLAGEN", "Lokale Texterkennung fehlgeschlagen");
  }
}

function normalisiere(s: string): string {
  return s
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dekodiereText(b: Buffer): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return b.subarray(3).toString("utf8");
  if (b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString("utf16le");
  const utf8 = b.toString("utf8");
  // Invalid UTF-8 yields U+FFFD; legacy Windows files are usually cp1252.
  return utf8.includes("�") ? cp1252(b) : utf8;
}

const CP1252_EXTRA: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x84: "„", 0x85: "…", 0x8a: "Š", 0x8c: "Œ", 0x8e: "Ž",
  0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x99: "™", 0x9a: "š", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function cp1252(b: Buffer): string {
  let out = "";
  for (const byte of b) out += CP1252_EXTRA[byte] ?? String.fromCharCode(byte);
  return out;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function pdfText(daten: Buffer): Promise<{ text: string; seiten: number }> {
  // pdf-parse v2 exports a class. It works on a copy so zeroing the input stays safe.
  const { PDFParse } = (await import("pdf-parse")) as unknown as {
    PDFParse: new (opts: { data: Uint8Array }) => {
      getText: () => Promise<{ text: string; total?: number; pages?: unknown[] }>;
      destroy: () => Promise<void>;
    };
  };
  const parser = new PDFParse({ data: new Uint8Array(daten) });
  try {
    const r = await parser.getText();
    const seiten = typeof r.total === "number" ? r.total : Array.isArray(r.pages) ? r.pages.length : 1;
    // pdf-parse inserts "-- 1 of 3 --" page markers; they carry no content.
    const text = (r.text ?? "").replace(/^-- \d+ of \d+ --$/gm, "");
    return { text, seiten };
  } catch {
    throw new PipelineFehler("konvertieren", "DATEI_DEFEKT", "PDF nicht lesbar");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// XML helpers (preserveOrder tree)
// ---------------------------------------------------------------------------

type XNode = Record<string, unknown> & { ":@"?: Record<string, string> };

const xml = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
});

function tagName(n: XNode): string {
  return Object.keys(n).find((k) => k !== ":@") ?? "";
}
function kinder(n: XNode): XNode[] {
  const v = n[tagName(n)];
  return Array.isArray(v) ? (v as XNode[]) : [];
}
function attr(n: XNode, name: string): string | undefined {
  return n[":@"]?.[name];
}
function findeAlle(nodes: XNode[], name: string, out: XNode[] = []): XNode[] {
  for (const n of nodes) {
    if (tagName(n) === name) out.push(n);
    else findeAlle(kinder(n), name, out);
  }
  return out;
}

function ladeZip(daten: Buffer): PizZip {
  const zip = new PizZip(daten);
  let summe = 0;
  for (const f of Object.values(zip.files)) {
    const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    summe += size;
  }
  if (summe > MAX_ENTPACKT_BYTES) {
    throw new PipelineFehler("konvertieren", "DATEI_ZU_GROSS", "Entpackter Inhalt zu groß (ZIP-Bombe?)");
  }
  return zip;
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function docxZuMarkdown(daten: Buffer, hinweise: string[]): string {
  const zip = ladeZip(daten);
  const teile: string[] = [];

  const kopf = Object.keys(zip.files).filter((p) => /^word\/header\d*\.xml$/.test(p)).sort();
  const fuss = Object.keys(zip.files).filter((p) => /^word\/footer\d*\.xml$/.test(p)).sort();

  const kopfText = kopf.map((p) => docxXml(zip.file(p)!.asText())).filter(Boolean).join("\n\n");
  if (kopfText) teile.push(kopfText);
  teile.push(docxXml(zip.file("word/document.xml")!.asText()));

  for (const [pfad, titel] of [
    ["word/footnotes.xml", "Fußnoten"],
    ["word/endnotes.xml", "Endnoten"],
    ["word/comments.xml", "Kommentare"],
  ] as const) {
    const f = zip.file(pfad);
    if (!f) continue;
    const t = docxXml(f.asText()).trim();
    if (t) {
      teile.push(`## ${titel}\n\n${t}`);
      if (pfad === "word/comments.xml") hinweise.push("Dokument enthält Kommentare, sie wurden mit übernommen");
    }
  }
  const fussText = fuss.map((p) => docxXml(zip.file(p)!.asText())).filter(Boolean).join("\n\n");
  if (fussText) teile.push(fussText);

  if (zip.file("word/media/image1.png") || Object.keys(zip.files).some((p) => p.startsWith("word/media/"))) {
    hinweise.push("Eingebettete Bilder wurden nicht ausgewertet");
  }
  return teile.join("\n\n");
}

function docxXml(s: string): string {
  const baum = xml.parse(s) as XNode[];
  const body = findeAlle(baum, "w:body")[0] ?? findeAlle(baum, "w:hdr")[0] ?? findeAlle(baum, "w:ftr")[0];
  const wurzel = body ? kinder(body) : baum;
  return docxBlock(wurzel).join("\n\n");
}

function docxBlock(nodes: XNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const t = tagName(n);
    if (t === "w:p") {
      const p = docxParagraph(n);
      if (p.trim()) out.push(p);
    } else if (t === "w:tbl") {
      out.push(docxTabelle(n));
    } else if (t === "w:sdt" || t === "w:sdtContent" || t === "w:footnote" || t === "w:endnote" || t === "w:comment" || t === "w:footnotes" || t === "w:endnotes" || t === "w:comments") {
      out.push(...docxBlock(kinder(n)));
    }
  }
  return out;
}

function docxParagraph(p: XNode): string {
  let stil = "";
  let liste = false;
  const pPr = kinder(p).find((k) => tagName(k) === "w:pPr");
  if (pPr) {
    for (const k of kinder(pPr)) {
      if (tagName(k) === "w:pStyle") stil = attr(k, "w:val") ?? "";
      if (tagName(k) === "w:numPr") liste = true;
    }
  }
  const text = docxInline(kinder(p)).replace(/[ \t]+/g, " ").trim();
  if (!text) return "";
  const h = /(?:Heading|berschrift)\s*(\d)$/i.exec(stil);
  if (h) return `${"#".repeat(Math.min(6, Number(h[1])))} ${text}`;
  if (/^Title$/i.test(stil)) return `# ${text}`;
  if (liste) return `- ${text}`;
  return text;
}

function docxInline(nodes: XNode[]): string {
  let s = "";
  for (const n of nodes) {
    const t = tagName(n);
    if (t === "#text") s += String(n["#text"] ?? "");
    else if (t === "w:t" || t === "w:delText") {
      if (t === "w:delText") continue; // deleted text in tracked changes is not current content
      s += kinder(n).map((k) => String(k["#text"] ?? "")).join("");
    } else if (t === "w:tab") s += "\t";
    else if (t === "w:br" || t === "w:cr") s += "  \n";
    else if (t === "w:pPr" || t === "w:rPr" || t === "w:del" || t === "w:instrText") continue;
    else s += docxInline(kinder(n));
  }
  return s;
}

function docxTabelle(tbl: XNode): string {
  const zeilen = kinder(tbl)
    .filter((r) => tagName(r) === "w:tr")
    .map((r) =>
      kinder(r)
        .filter((c) => tagName(c) === "w:tc")
        .map((c) => docxBlock(kinder(c)).join(" ").replace(/\|/g, "\\|").replace(/\n+/g, " ")),
    );
  return mdTabelle(zeilen);
}

function mdTabelle(zeilen: string[][]): string {
  if (zeilen.length === 0) return "";
  const breite = Math.max(...zeilen.map((z) => z.length));
  const fill = (z: string[]) => [...z, ...Array(breite - z.length).fill("")];
  const [kopf, ...rest] = zeilen.map(fill);
  return [
    `| ${kopf.join(" | ")} |`,
    `| ${kopf.map(() => "---").join(" | ")} |`,
    ...rest.map((z) => `| ${z.join(" | ")} |`),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// ODT
// ---------------------------------------------------------------------------

function odtZuMarkdown(daten: Buffer, hinweise: string[]): string {
  const zip = ladeZip(daten);
  const content = zip.file("content.xml");
  if (!content) throw new PipelineFehler("konvertieren", "DATEI_DEFEKT", "ODT ohne content.xml");
  const teile: string[] = [];

  // Header/footer live in styles.xml (master pages).
  const styles = zip.file("styles.xml");
  if (styles) {
    const baum = xml.parse(styles.asText()) as XNode[];
    const kf = [...findeAlle(baum, "style:header"), ...findeAlle(baum, "style:footer")];
    const t = kf.flatMap((n) => odtBlock(kinder(n))).join("\n\n").trim();
    if (t) teile.push(t);
  }

  const baum = xml.parse(content.asText()) as XNode[];
  const text = findeAlle(baum, "office:text")[0];
  teile.push(odtBlock(text ? kinder(text) : []).join("\n\n"));
  if (findeAlle(baum, "office:annotation").length > 0) {
    hinweise.push("Dokument enthält Kommentare, sie wurden mit übernommen");
  }
  if (Object.keys(zip.files).some((p) => p.startsWith("Pictures/"))) {
    hinweise.push("Eingebettete Bilder wurden nicht ausgewertet");
  }
  return teile.join("\n\n");
}

function odtBlock(nodes: XNode[], listenTiefe = 0): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const t = tagName(n);
    if (t === "text:h") {
      const lvl = Number(attr(n, "text:outline-level") ?? "1");
      const s = odtInline(kinder(n)).trim();
      if (s) out.push(`${"#".repeat(Math.min(6, lvl))} ${s}`);
    } else if (t === "text:p") {
      const s = odtInline(kinder(n)).replace(/[ \t]+/g, " ").trim();
      if (s) out.push(listenTiefe > 0 ? `${"  ".repeat(listenTiefe - 1)}- ${s}` : s);
    } else if (t === "text:list") {
      out.push(odtBlock(kinder(n), listenTiefe + 1).join("\n"));
    } else if (t === "text:list-item" || t === "text:section" || t === "office:annotation") {
      out.push(...odtBlock(kinder(n), listenTiefe));
    } else if (t === "table:table") {
      const zeilen = findeAlle(kinder(n), "table:table-row").map((r) =>
        kinder(r)
          .filter((c) => tagName(c) === "table:table-cell")
          .map((c) => odtBlock(kinder(c)).join(" ").replace(/\|/g, "\\|").replace(/\n+/g, " ")),
      );
      out.push(mdTabelle(zeilen));
    }
  }
  return out;
}

function odtInline(nodes: XNode[]): string {
  let s = "";
  for (const n of nodes) {
    const t = tagName(n);
    if (t === "#text") s += String(n["#text"] ?? "");
    else if (t === "text:s") s += " ".repeat(Number(attr(n, "text:c") ?? "1"));
    else if (t === "text:tab") s += "\t";
    else if (t === "text:line-break") s += "  \n";
    else if (t === "office:annotation") s += ` [Kommentar: ${odtBlock(kinder(n)).join(" ")}] `;
    else s += odtInline(kinder(n));
  }
  return s;
}

// ---------------------------------------------------------------------------
// HTML, CSV, RTF, EML
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö",
  uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", euro: "€", sect: "§", ndash: "–", mdash: "—",
};

export function htmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return HTML_ENTITIES[e] ?? m;
  });
}

export function htmlZuMarkdown(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|noscript|template)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n\n${"#".repeat(Number(l))} ${t}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<\/(p|div|section|article|ul|ol|table|blockquote|li)>/gi, "\n\n")
    .replace(/<tr[^>]*>/gi, "\n| ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => `[${t}](${href})`)
    .replace(/<[^>]+>/g, "");
  s = htmlEntities(s);
  return s.replace(/[ \t]+/g, " ").replace(/\n /g, "\n");
}

export function csvZuMarkdown(csv: string): string {
  const trenner = (csv.split("\n")[0].match(/;/g)?.length ?? 0) > (csv.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const zeilen: string[][] = [];
  let feld = "";
  let zeile: string[] = [];
  let inQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuote) {
      if (c === '"' && csv[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQuote = false;
      else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((f) => f.trim())) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim())) zeilen.push(zeile);
  return mdTabelle(zeilen.map((z) => z.map((f) => f.trim().replace(/\|/g, "\\|"))));
}

export function rtfZuText(rtf: string): string {
  let out = "";
  const stack: boolean[] = [];
  let skip = false;
  let ucSkip = 0;
  const SKIP_DESTS = new Set(["fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "themedata", "colorschememapping", "latentstyles", "datastore"]);
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === "{") { stack.push(skip); continue; }
    if (c === "}") { skip = stack.pop() ?? false; continue; }
    if (c === "\\") {
      const n = rtf[i + 1];
      if (n === "\\" || n === "{" || n === "}") { if (!skip) out += n; i++; continue; }
      if (n === "'") {
        const hex = rtf.substr(i + 2, 2);
        if (ucSkip > 0) ucSkip--;
        else if (!skip) out += cp1252(Buffer.from([parseInt(hex, 16)]));
        i += 3; continue;
      }
      if (n === "*") { skip = true; i++; continue; }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) { i++; continue; }
      const [ganz, wort, zahl] = m;
      i += ganz.length;
      if (SKIP_DESTS.has(wort)) skip = true;
      else if (skip) continue;
      else if (wort === "par" || wort === "line") out += "\n";
      else if (wort === "tab") out += "\t";
      else if (wort === "cell") out += " | ";
      else if (wort === "row") out += "\n";
      else if (wort === "u" && zahl) {
        let cp = Number(zahl);
        if (cp < 0) cp += 65536;
        out += String.fromCharCode(cp);
        ucSkip = 1;
      }
      continue;
    }
    if (c === "\r" || c === "\n") continue;
    if (!skip) {
      if (ucSkip > 0) { ucSkip--; continue; }
      out += c;
    }
  }
  return out;
}

function decodeQP(s: string): Buffer {
  const bytes: number[] = [];
  const t = s.replace(/=\r?\n/g, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-F]{2}$/i.test(t.substr(i + 1, 2))) {
      bytes.push(parseInt(t.substr(i + 1, 2), 16)); i += 2;
    } else bytes.push(t.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes);
}

function decodeHeaderWort(s: string): string {
  return s.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, cs: string, enc: string, txt: string) => {
    const buf = enc.toLowerCase() === "b" ? Buffer.from(txt, "base64") : decodeQP(txt.replace(/_/g, " "));
    return /utf-?8/i.test(cs) ? buf.toString("utf8") : cp1252(buf);
  });
}

interface MimeTeil { header: Record<string, string>; body: string }

function parseMime(raw: string): MimeTeil {
  const idx = raw.search(/\r?\n\r?\n/);
  const kopf = idx >= 0 ? raw.slice(0, idx) : raw;
  const body = idx >= 0 ? raw.slice(idx).replace(/^\r?\n\r?\n/, "") : "";
  const header: Record<string, string> = {};
  for (const zeile of kopf.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(zeile);
    if (m) header[m[1].toLowerCase()] = m[2];
  }
  return { header, body };
}

function teilText(t: MimeTeil): string {
  const cte = (t.header["content-transfer-encoding"] ?? "").toLowerCase();
  const charset = /charset="?([^";]+)/i.exec(t.header["content-type"] ?? "")?.[1] ?? "utf-8";
  const buf = cte === "base64" ? Buffer.from(t.body.replace(/\s/g, ""), "base64")
    : cte === "quoted-printable" ? decodeQP(t.body) : Buffer.from(t.body, "latin1");
  return /utf-?8/i.test(charset) ? buf.toString("utf8") : cp1252(buf);
}

function emlZuMarkdown(raw: string, hinweise: string[]): string {
  const wurzel = parseMime(raw);
  const kopfzeilen = ["from", "to", "cc", "date", "subject"]
    .filter((k) => wurzel.header[k])
    .map((k) => `**${{ from: "Von", to: "An", cc: "Cc", date: "Datum", subject: "Betreff" }[k]}:** ${decodeHeaderWort(wurzel.header[k])}`);

  let text = "";
  let html = "";
  let anhaenge = 0;
  const besuche = (t: MimeTeil) => {
    const ct = (t.header["content-type"] ?? "text/plain").toLowerCase();
    const disp = (t.header["content-disposition"] ?? "").toLowerCase();
    if (ct.startsWith("multipart/")) {
      const grenze = /boundary="?([^";]+)"?/i.exec(t.header["content-type"] ?? "")?.[1];
      if (!grenze) return;
      for (const stueck of t.body.split(`--${grenze}`).slice(1)) {
        if (stueck.startsWith("--")) break;
        besuche(parseMime(stueck.replace(/^\r?\n/, "")));
      }
    } else if (disp.startsWith("attachment")) {
      anhaenge++;
    } else if (ct.startsWith("text/plain") && !text) {
      text = teilText(t);
    } else if (ct.startsWith("text/html") && !html) {
      html = teilText(t);
    } else if (!ct.startsWith("text/")) {
      anhaenge++;
    }
  };
  besuche(wurzel);
  if (anhaenge > 0) hinweise.push(`${anhaenge} E-Mail-Anhang/Anhänge nicht verarbeitet, bitte einzeln einreichen`);
  return `${kopfzeilen.join("  \n")}\n\n${text || htmlZuMarkdown(html)}`;
}
