/**
 * search_urteile tool: Semantic case law search via pgvector.
 *
 * Generates a query embedding and searches urteil_chunks for
 * relevant court decisions. Returns formatted results with scores.
 */

import { tool } from "ai";
import { z } from "zod";
import { generateQueryEmbedding } from "@/lib/embedding/embedder";
import { searchUrteilChunks } from "@/lib/urteile/ingestion";
import type { ToolContext, ToolResult } from "../types";

export function createSearchUrteileTool(ctx: ToolContext) {
  return tool({
    description:
      "Search German court decisions (Urteile/Beschluesse) by semantic similarity. Finds relevant case law from BGH, BAG, OLG, etc. Returns Aktenzeichen, court, date, Rechtsgebiet, content excerpt, and relevance score.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Natural language search query describing the legal issue or precedent sought.",
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

      const results = await searchUrteilChunks(embedding, { limit });

      return {
        data: results.map((r) => ({
          aktenzeichen: r.aktenzeichen,
          gericht: r.gericht,
          datum: r.datum instanceof Date ? r.datum.toISOString() : r.datum,
          rechtsgebiet: r.rechtsgebiet,
          content:
            r.content.length > 2000
              ? r.content.slice(0, 2000) + "..."
              : r.content,
          score: Math.round(r.score * 1000) / 1000,
          sourceUrl: r.sourceUrl,
        })),
        source: {
          table: "urteil_chunks",
          chunkIds: results.map((r) => r.id),
          query,
        },
      };
    },
  });
}
