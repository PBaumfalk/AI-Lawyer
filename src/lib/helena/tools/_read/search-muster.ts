/**
 * search_muster tool: Semantic template search via pgvector.
 *
 * Generates a query embedding and searches muster_chunks for
 * relevant document templates. Returns formatted results with scores.
 */

import { tool } from "ai";
import { z } from "zod";
import { generateQueryEmbedding } from "@/lib/embedding/embedder";
import { searchMusterChunks } from "@/lib/muster/ingestion";
import type { ToolContext, ToolResult } from "../types";

export function createSearchMusterTool(ctx: ToolContext) {
  return tool({
    description:
      "Search document templates (Muster/Vorlagen) by semantic similarity. Finds relevant templates for Schriftsaetze, Klagen, Vertraege, etc. Kanzlei-eigene templates are boosted in ranking.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Natural language query describing the type of template needed.",
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum results to return (default 5)."),
    }),
    execute: async ({ query, limit }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      let embedding: number[];
      try {
        embedding = await generateQueryEmbedding(query);
      } catch {
        return {
          error:
            "Embedding-Dienst nicht verfuegbar. Versuche es spaeter erneut.",
        };
      }

      const results = await searchMusterChunks(embedding, { limit });

      return {
        data: results.map((r) => ({
          musterName: r.musterName,
          kategorie: r.kategorie,
          content:
            r.content.length > 2000
              ? r.content.slice(0, 2000) + "..."
              : r.content,
          kanzleiEigen: r.kanzleiEigen,
          score: Math.round(r.score * 1000) / 1000,
        })),
        source: {
          table: "muster_chunks",
          chunkIds: results.map((r) => r.id),
          query,
        },
      };
    },
  });
}
