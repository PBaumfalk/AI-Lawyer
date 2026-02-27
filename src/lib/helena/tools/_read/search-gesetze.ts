/**
 * search_gesetze tool: Semantic law search via pgvector.
 *
 * Generates a query embedding and searches law_chunks for
 * relevant paragraphs. Returns formatted citations with scores.
 */

import { tool } from "ai";
import { z } from "zod";
import { generateQueryEmbedding } from "@/lib/embedding/embedder";
import { searchLawChunks } from "@/lib/gesetze/ingestion";
import type { ToolContext, ToolResult } from "../types";

export function createSearchGesetzeTool(ctx: ToolContext) {
  return tool({
    description:
      "Search German law texts (Gesetze) by semantic similarity. Finds relevant paragraphs from BGB, StGB, ZPO, etc. Returns citations with paragraph number, law abbreviation, title, content excerpt, and relevance score.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Natural language search query describing the legal question or topic.",
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

      const results = await searchLawChunks(embedding, { limit });

      return {
        data: results.map((r) => ({
          paragraphNr: r.paragraphNr,
          gesetzKuerzel: r.gesetzKuerzel,
          titel: r.titel,
          content:
            r.content.length > 2000
              ? r.content.slice(0, 2000) + "..."
              : r.content,
          score: Math.round(r.score * 1000) / 1000,
          sourceUrl: r.sourceUrl,
        })),
        source: {
          table: "gesetze_chunks",
          chunkIds: results.map((r) => r.id),
          query,
        },
      };
    },
  });
}
