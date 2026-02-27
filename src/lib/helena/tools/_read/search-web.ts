/**
 * search_web tool: STUB -- Web search not yet configured.
 *
 * Per RESEARCH.md open question #1, this is a placeholder that
 * returns a helpful error message. Full implementation requires
 * a search API integration (Brave Search, SerpAPI, etc.).
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createSearchWebTool(_ctx: ToolContext) {
  return tool({
    description:
      "Search the web for current legal information, BGH decisions, or general legal research. NOTE: This tool is currently a placeholder and not yet connected to a search API.",
    parameters: z.object({
      query: z
        .string()
        .describe("The web search query."),
    }),
    execute: async (): Promise<ToolResult> => {
      return {
        error:
          "Web-Suche ist noch nicht konfiguriert. Nutze search_gesetze und search_urteile fuer rechtliche Recherche.",
      };
    },
  });
}
