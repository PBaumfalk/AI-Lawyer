/**
 * read_fristen tool: Deadlines and appointments for an Akte.
 *
 * Returns KalenderEintrag records (Frist/Termin/Wiedervorlage)
 * with optional status filter: "active" (future), "past", or "all".
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadFristenTool(ctx: ToolContext) {
  return tool({
    description:
      "Read deadlines (Fristen), appointments (Termine), and follow-ups (Wiedervorlagen) for an Akte. Filter by status: 'active' (upcoming, default), 'past' (expired), or 'all'.",
    parameters: z.object({
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
      status: z
        .enum(["active", "past", "all"])
        .optional()
        .default("active")
        .describe(
          "Filter: 'active' = datum >= today (default), 'past' = datum < today, 'all' = no filter.",
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum entries to return (default 20)."),
    }),
    execute: async ({ akteId: inputAkteId, status, limit }): Promise<ToolResult> => {
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

      const now = new Date();
      const where: Record<string, unknown> = { akteId: targetId };

      if (status === "active") {
        where.datum = { gte: now };
      } else if (status === "past") {
        where.datum = { lt: now };
      }
      // "all" = no date filter

      const eintraege = await ctx.prisma.kalenderEintrag.findMany({
        where,
        select: {
          id: true,
          typ: true,
          titel: true,
          beschreibung: true,
          datum: true,
          datumBis: true,
          ganztaegig: true,
          erledigt: true,
          prioritaet: true,
          istNotfrist: true,
          verantwortlich: { select: { name: true } },
        },
        orderBy: { datum: "asc" },
        take: limit,
      });

      return {
        data: eintraege.map((e) => ({
          id: e.id,
          typ: e.typ,
          titel: e.titel,
          beschreibung:
            e.beschreibung && e.beschreibung.length > 500
              ? e.beschreibung.slice(0, 500) + "..."
              : e.beschreibung,
          datum: e.datum.toISOString(),
          datumBis: e.datumBis?.toISOString() ?? null,
          ganztaegig: e.ganztaegig,
          erledigt: e.erledigt,
          prioritaet: e.prioritaet,
          istNotfrist: e.istNotfrist,
          verantwortlich: e.verantwortlich.name,
        })),
        source: { table: "kalender_eintraege" },
      };
    },
  });
}
