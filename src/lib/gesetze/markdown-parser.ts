/**
 * Parser for bundestag/gesetze Markdown format.
 * Splits each Gesetz file into LawParagraph objects — one per § heading.
 * No external Markdown library needed — format uses a simple state machine.
 */

export interface LawParagraph {
  gesetzKuerzel: string; // from jurabk frontmatter, e.g. "BGB"
  paragraphNr: string;   // e.g. "§ 626"
  titel: string;         // e.g. "Fristlose Kündigung aus wichtigem Grund"
  inhalt: string;        // full paragraph body text (all Absätze joined)
  stand: string;         // raw "Zuletzt geändert durch" string — store as-is, use syncedAt for display
  slug: string;          // directory slug, e.g. "bgb"
}

/**
 * Smoke test for encoding correctness.
 * Returns false (skip file) if § character appears as "Â§" — classic UTF-8 bytes
 * decoded as latin-1 (mojibake). Log a warning; do NOT throw. Caller must skip the file.
 */
export function encodingSmokePassed(content: string, slug: string): boolean {
  if (content.includes("Â§")) {
    console.warn(`[gesetze-sync] ENCODING FAIL: §-Zeichen appears as "Â§" in ${slug} — skipping file`);
    return false;
  }
  return true;
}

/**
 * Parse a bundestag/gesetze Markdown file into structured LawParagraph objects.
 * One object per ##### § heading. Paragraphs with < 10 chars body are skipped.
 *
 * @param markdown - Raw file content from fetchRawFileContent()
 * @param fallbackSlug - Directory slug (e.g. "bgb") used if jurabk not found in frontmatter
 */
export function parseGesetzeMarkdown(markdown: string, fallbackSlug: string): LawParagraph[] {
  const results: LawParagraph[] = [];

  // 1. Extract YAML frontmatter (between first two "---" delimiters)
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? "";

  // Extract gesetzKuerzel from jurabk field
  const jurabkMatch = frontmatter.match(/^jurabk:\s*(.+)$/m);
  const gesetzKuerzel = jurabkMatch?.[1]?.trim() ?? fallbackSlug.toUpperCase();

  // Extract amendment date as raw string (free-text German legal citation format)
  const standMatch = markdown.match(/Zuletzt ge[äa]ndert durch\n:\s+(.+)/);
  const stand = standMatch?.[1]?.trim() ?? "Stand unbekannt";

  // 2. Line-by-line state machine — split by ##### headings
  const lines = markdown.split("\n");
  let currentParagraphNr: string | null = null;
  let currentTitel = "";
  let contentLines: string[] = [];

  const saveCurrent = () => {
    if (currentParagraphNr === null) return;
    const inhalt = contentLines.join("\n").trim();
    if (inhalt.length >= 10) {
      results.push({
        gesetzKuerzel,
        paragraphNr: currentParagraphNr,
        titel: currentTitel,
        inhalt,
        stand,
        slug: fallbackSlug,
      });
    }
  };

  for (const line of lines) {
    // Match exactly 5 hashes: ##### § N Title
    const paraMatch = line.match(/^##### (§\s*\S+)\s+(.+)$/);
    if (paraMatch) {
      saveCurrent();
      currentParagraphNr = paraMatch[1].trim();  // "§ 626"
      currentTitel = paraMatch[2].trim();          // "Fristlose Kündigung..."
      contentLines = [];
    } else if (currentParagraphNr !== null) {
      // Inside a paragraph — skip sub-section headings (##, ###, ####) which are
      // organizational structure, not paragraph content
      if (!line.startsWith("#")) {
        contentLines.push(line);
      }
    }
  }
  saveCurrent(); // Save last paragraph

  return results;
}
