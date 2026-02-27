/**
 * read_dokumente tool: List documents for an Akte.
 *
 * Returns summary fields: id, name, status, mimeType, groesse,
 * createdAt. Supports optional kategorie filter and limit.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadDokumenteTool(ctx: ToolContext) {
  return tool({
    description:
      "List documents (Dokumente) for an Akte. Returns id, name, status, mimeType, size, and createdAt. Use read_dokumente_detail for full document content including OCR text.",
    parameters: z.object({
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
      kategorie: z
        .string()
        .optional()
        .describe(
          "Filter by document status (e.g. ENTWURF, ZUR_PRUEFUNG, FREIGEGEBEN, VERSENDET).",
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of documents to return (default 20)."),
    }),
    execute: async ({ akteId: inputAkteId, kategorie, limit }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetId = inputAkteId ?? ctx.akteId;
      if (!targetId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      // Verify RBAC access to the Akte
      const akteExists = await ctx.prisma.akte.findFirst({
        where: { id: targetId, ...ctx.akteAccessFilter },
        select: { id: true },
      });

      if (!akteExists) {
        return {
          error: "Akte nicht gefunden oder kein Zugriff.",
          source: { table: "akte" },
        };
      }

      const where: Record<string, unknown> = { akteId: targetId };
      if (kategorie) {
        where.status = kategorie;
      }

      const dokumente = await ctx.prisma.dokument.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          mimeType: true,
          groesse: true,
          ordner: true,
          tags: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return {
        data: dokumente.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          mimeType: d.mimeType,
          groesse: d.groesse,
          ordner: d.ordner,
          tags: d.tags,
          createdAt: d.createdAt.toISOString(),
        })),
        source: { table: "dokument" },
      };
    },
  });
}
