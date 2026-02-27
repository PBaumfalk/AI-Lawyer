/**
 * read_akte tool: Summary info about an Akte (case file).
 *
 * Returns compact key fields: Aktenzeichen, status, Sachgebiet,
 * Kurzrubrum, Gegenstandswert, assigned staff, and entity counts.
 * Use read_akte_detail for full data.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadAkteTool(ctx: ToolContext) {
  return tool({
    description:
      "Read summary info about an Akte (case file): Aktenzeichen, status, Sachgebiet, Kurzrubrum, Gegenstandswert, assigned Anwalt/Sachbearbeiter, and counts of Dokumente/Fristen/Beteiligte. Use read_akte_detail for full data.",
    parameters: z.object({
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
    }),
    execute: async ({ akteId: inputAkteId }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetId = inputAkteId ?? ctx.akteId;
      if (!targetId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      const akte = await ctx.prisma.akte.findFirst({
        where: {
          id: targetId,
          ...ctx.akteAccessFilter,
        },
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          sachgebiet: true,
          status: true,
          gegenstandswert: true,
          anwalt: { select: { name: true } },
          sachbearbeiter: { select: { name: true } },
          _count: {
            select: {
              dokumente: true,
              kalenderEintraege: true,
              beteiligte: true,
            },
          },
        },
      });

      if (!akte) {
        return {
          error: "Akte nicht gefunden oder kein Zugriff.",
          source: { table: "akte" },
        };
      }

      return {
        data: {
          id: akte.id,
          aktenzeichen: akte.aktenzeichen,
          kurzrubrum: akte.kurzrubrum,
          sachgebiet: akte.sachgebiet,
          status: akte.status,
          gegenstandswert: akte.gegenstandswert?.toString() ?? null,
          anwalt: akte.anwalt?.name ?? null,
          sachbearbeiter: akte.sachbearbeiter?.name ?? null,
          dokumenteCount: akte._count.dokumente,
          fristenCount: akte._count.kalenderEintraege,
          beteiligteCount: akte._count.beteiligte,
        },
        source: { table: "akte", id: akte.id },
      };
    },
  });
}
