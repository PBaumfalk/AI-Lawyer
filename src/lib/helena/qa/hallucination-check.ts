/**
 * Hallucination detection for Helena Schriftsatz drafts (QA-05).
 *
 * Extracts legal references (paragraph citations, Aktenzeichen) from
 * generated text via regex, then verifies each against the retrieval
 * sources (belege). References not found in sources are hallucinations.
 */

/**
 * Extract all paragraph references from generated text.
 * Matches patterns like:
 * - SS 622 BGB
 * - SSSS 1, 2 KSchG
 * - Art. 12 GG
 * - SS 622 Abs. 1 BGB
 * - SS 1 Abs. 3 KSchG
 */
export function extractParagraphRefs(text: string): string[] {
  const patterns = [
    // SS X (Abs. Y) LawName -- e.g. "SS 622 Abs. 1 BGB", "SS 1 KSchG"
    /(?:SSSS?\s*\d+[\s,]*(?:(?:Abs\.\s*\d+|S\.\s*\d+|Nr\.\s*\d+)[\s,]*)*\s*[A-Z][A-Za-zaeoeue]*(?:\s*[A-Z][A-Za-zaeoeue]*)?)/g,
    // Art. X GG/EU -- e.g. "Art. 12 GG"
    /Art\.\s*\d+\s*[A-Z]+/g,
  ];

  const refs: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      refs.push(match[0].trim());
    }
  }
  return Array.from(new Set(refs)); // Deduplicate
}

/**
 * Extract Aktenzeichen (case references) from text.
 * Matches patterns like: 2 AZR 123/22, 6 AZR 1234/21, 1 BvR 123/18
 */
export function extractAktenzeichen(text: string): string[] {
  const pattern = /\d+\s+[A-Z]{2,4}\s+\d+\/\d{2}/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    results.push(match[0].trim());
  }
  return Array.from(new Set(results));
}

/**
 * Find hallucinated references: refs in text that do NOT appear in any retrieval source.
 * Returns the list of unsupported references.
 *
 * @param draftText - The full text of the generated Schriftsatz draft
 * @param belege - Retrieval sources with referenz and auszug fields
 * @returns Array of reference strings that appear in the draft but not in sources
 */
export function findHallucinations(
  draftText: string,
  belege: Array<{ referenz: string; auszug: string }>,
): string[] {
  const refs = [
    ...extractParagraphRefs(draftText),
    ...extractAktenzeichen(draftText),
  ];
  if (refs.length === 0) return [];

  // Build a combined source text from all retrieval belege
  const sourceText = belege
    .map((b) => `${b.referenz} ${b.auszug}`)
    .join(" ")
    .toLowerCase();

  return refs.filter((ref) => {
    const normalized = ref.replace(/\s+/g, " ").toLowerCase();
    // Check if the core reference (number + law abbreviation) appears in sources
    return !sourceText.includes(normalized);
  });
}

/**
 * Compute hallucination rate across multiple drafts.
 * Rate = total_hallucinated_refs / total_refs_found
 *
 * @param results - Per-draft results with total and hallucinated ref counts
 * @returns Rate between 0.0 and 1.0 (lower is better)
 */
export function halluzinationsrate(
  results: Array<{ totalRefs: number; hallucinatedRefs: number }>,
): number {
  const totalRefs = results.reduce((sum, r) => sum + r.totalRefs, 0);
  if (totalRefs === 0) return 0;
  const totalHallucinated = results.reduce(
    (sum, r) => sum + r.hallucinatedRefs,
    0,
  );
  return totalHallucinated / totalRefs;
}
