/**
 * search_alle_akten tool: Cross-case search.
 *
 * Searches across all accessible Akten by kurzrubrum and
 * aktenzeichen, with optional status and sachgebiet filters.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createSearchAlleAktenTool(ctx: ToolContext) {
  return tool({
    description:
      "Search across all accessible Akten (case files). Searches by Kurzrubrum and Aktenzeichen. Supports optional filters for status and Sachgebiet.",
    parameters: z.object({
      query: z
        .string()
        .describe(
          "Search text (searches Kurzrubrum and Aktenzeichen, case-insensitive).",
        ),
      status: z
        .string()
        .optional()
        .describe(
          "Filter by Akte status (e.g. OFFEN, RUHEND, ARCHIVIERT, GESCHLOSSEN).",
        ),
      sachgebiet: z
        .string()
        .optional()
        .describe(
          "Filter by Sachgebiet (e.g. ARBEITSRECHT, FAMILIENRECHT, MIETRECHT).",
        ),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum results to return (default 10)."),
    }),
    execute: async ({ query, status, sachgebiet, limit }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const where: Record<string, unknown> = {
        ...ctx.akteAccessFilter,
        OR: [
          { kurzrubrum: { contains: query, mode: "insensitive" } },
          { aktenzeichen: { contains: query, mode: "insensitive" } },
        ],
      };

      if (status) {
        where.status = status;
      }
      if (sachgebiet) {
        where.sachgebiet = sachgebiet;
      }

      const akten = await ctx.prisma.akte.findMany({
        where,
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          status: true,
          sachgebiet: true,
          gegenstandswert: true,
          anwalt: { select: { name: true } },
          angelegt: true,
        },
        orderBy: { geaendert: "desc" },
        take: limit,
      });

      return {
        data: akten.map((a) => ({
          id: a.id,
          aktenzeichen: a.aktenzeichen,
          kurzrubrum: a.kurzrubrum,
          status: a.status,
          sachgebiet: a.sachgebiet,
          gegenstandswert: a.gegenstandswert?.toString() ?? null,
          anwalt: a.anwalt?.name ?? null,
          angelegt: a.angelegt.toISOString(),
        })),
        source: { table: "akte", query },
      };
    },
  });
}
