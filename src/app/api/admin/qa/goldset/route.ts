import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { GOLDSET_QUERIES } from "@/lib/helena/qa/goldset";
import {
  recallAtK,
  mrr,
  formaleVollstaendigkeit,
} from "@/lib/helena/qa/metrics";
import {
  findHallucinations,
  extractParagraphRefs,
  extractAktenzeichen,
} from "@/lib/helena/qa/hallucination-check";

// GET /api/admin/qa/goldset -- Returns goldset query definitions for display
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  return NextResponse.json({
    queries: GOLDSET_QUERIES,
    count: GOLDSET_QUERIES.length,
  });
}

// POST /api/admin/qa/goldset -- Computes per-query metrics from submitted results
interface GoldsetResult {
  queryId: string;
  retrievedRefs: string[]; // Retrieved referenz values from RAG
  retrievedSections: string[]; // Sections present in the generated Schriftsatz
  draftText: string; // Full draft text for hallucination check
  belege: Array<{ referenz: string; auszug: string }>;
}

export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const { results } = (await request.json()) as { results: GoldsetResult[] };

  if (!results || !Array.isArray(results)) {
    return NextResponse.json(
      { error: "results Array erforderlich" },
      { status: 400 },
    );
  }

  // Compute per-query metrics
  const queryMetrics = results
    .map((queryResult) => {
      const goldset = GOLDSET_QUERIES.find((q) => q.id === queryResult.queryId);
      if (!goldset) return null;

      const recall = recallAtK(
        queryResult.retrievedRefs,
        goldset.expectedNormen,
        5,
      );
      const mrrValue = mrr(queryResult.retrievedRefs, goldset.expectedNormen);
      const vollstaendigkeit = formaleVollstaendigkeit(
        queryResult.retrievedSections,
        goldset.expectedSections,
      );

      const allRefs = [
        ...extractParagraphRefs(queryResult.draftText),
        ...extractAktenzeichen(queryResult.draftText),
      ];
      const hallucinations = findHallucinations(
        queryResult.draftText,
        queryResult.belege,
      );

      return {
        queryId: queryResult.queryId,
        description: goldset.description,
        recallAt5: recall,
        mrr: mrrValue,
        formaleVollstaendigkeit: vollstaendigkeit,
        totalRefs: allRefs.length,
        hallucinatedRefs: hallucinations.length,
        hallucinations,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    queryMetrics,
    timestamp: new Date().toISOString(),
  });
}
