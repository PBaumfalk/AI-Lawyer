/**
 * read_zeiterfassung tool: Time entries for an Akte.
 *
 * Returns Zeiterfassung records with beschreibung, dauer (minutes),
 * datum, user name, and billing info.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadZeiterfassungTool(ctx: ToolContext) {
  return tool({
    description:
      "Read time tracking entries (Zeiterfassung) for an Akte. Returns description, duration in minutes, date, user name, and billing status.",
    parameters: z.object({
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum entries to return (default 20)."),
    }),
    execute: async ({ akteId: inputAkteId, limit }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetId = inputAkteId ?? ctx.akteId;
      if (!targetId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      // RBAC check
      const akteAccess = await ctx.prisma.akte.findFirst({
        where: { id: targetId, ...ctx.akteAccessFilter },
        select: { id: true },
      });

      if (!akteAccess) {
        return {
          error: "Akte nicht gefunden oder kein Zugriff.",
          source: { table: "akte" },
        };
      }

      const eintraege = await ctx.prisma.zeiterfassung.findMany({
        where: { akteId: targetId },
        select: {
          id: true,
          beschreibung: true,
          dauer: true,
          datum: true,
          stundensatz: true,
          abrechenbar: true,
          abgerechnet: true,
          kategorie: true,
          user: { select: { name: true } },
        },
        orderBy: { datum: "desc" },
        take: limit,
      });

      return {
        data: eintraege.map((e) => ({
          id: e.id,
          beschreibung:
            e.beschreibung.length > 500
              ? e.beschreibung.slice(0, 500) + "..."
              : e.beschreibung,
          dauerMinuten: e.dauer,
          datum: e.datum.toISOString(),
          stundensatz: e.stundensatz?.toString() ?? null,
          abrechenbar: e.abrechenbar,
          abgerechnet: e.abgerechnet,
          kategorie: e.kategorie,
          bearbeiter: e.user.name,
        })),
        source: { table: "zeiterfassung" },
      };
    },
  });
}
