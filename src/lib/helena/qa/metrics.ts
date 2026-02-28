/**
 * Pure functions for IR (Information Retrieval) quality metrics (QA-03).
 *
 * All functions are side-effect-free and operate on arrays of strings.
 * Used for computing Recall@k, MRR, no-result-rate, and formale Vollstaendigkeit.
 */

/**
 * Normalize a legal reference for fuzzy matching.
 * Strips extra whitespace, normalizes paragraph symbols, lowercases.
 */
function normalizeRef(ref: string): string {
  return ref
    .replace(/\s+/g, " ")
    .replace(/\u00A7/g, "SS") // Replace actual paragraph sign with SS
    .replace(/[^\w\s.]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Recall@k: fraction of expected references found in the top-k retrieved results.
 * Comparison is case-insensitive and uses normalized substring matching.
 *
 * @param retrieved - Retrieved chunk references (from retrieval_belege[].referenz)
 * @param expected - Expected references from goldset
 * @param k - Number of top results to consider (default: 5)
 * @returns Recall score between 0.0 and 1.0
 */
export function recallAtK(
  retrieved: string[],
  expected: string[],
  k: number = 5,
): number {
  if (expected.length === 0) return 1; // No expectations = trivially satisfied
  const topK = retrieved.slice(0, k);
  const normalizedTopK = topK.map((r) => normalizeRef(r));
  const found = expected.filter((exp) => {
    const normExp = normalizeRef(exp);
    return normalizedTopK.some(
      (r) => r.includes(normExp) || normExp.includes(r),
    );
  });
  return found.length / expected.length;
}

/**
 * MRR (Mean Reciprocal Rank): 1/rank of the first relevant result.
 *
 * @param retrieved - Retrieved references in rank order
 * @param expected - Expected references
 * @returns Reciprocal rank (1/rank of first hit, or 0 if none found)
 */
export function mrr(retrieved: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  for (let i = 0; i < retrieved.length; i++) {
    const normRetrieved = normalizeRef(retrieved[i]);
    if (
      expected.some((exp) => {
        const normExp = normalizeRef(exp);
        return (
          normRetrieved.includes(normExp) || normExp.includes(normRetrieved)
        );
      })
    ) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * No-result rate: fraction of queries that returned zero results.
 *
 * @param resultCounts - Array of result counts per query
 * @returns Rate between 0.0 and 1.0
 */
export function noResultRate(resultCounts: number[]): number {
  if (resultCounts.length === 0) return 0;
  const noResults = resultCounts.filter((c) => c === 0).length;
  return noResults / resultCounts.length;
}

/**
 * Formale Vollstaendigkeit: fraction of expected sections present in the Schriftsatz.
 *
 * @param presentSections - Sections actually present in the generated Schriftsatz
 * @param expectedSections - Expected sections from goldset
 * @returns Completeness score between 0.0 and 1.0
 */
export function formaleVollstaendigkeit(
  presentSections: string[],
  expectedSections: string[],
): number {
  if (expectedSections.length === 0) return 1;
  const normalizedPresent = presentSections.map((s) => s.toLowerCase().trim());
  const found = expectedSections.filter((exp) =>
    normalizedPresent.some((p) => p.includes(exp.toLowerCase().trim())),
  );
  return found.length / expectedSections.length;
}
