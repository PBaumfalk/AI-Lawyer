/**
 * read_dokumente_detail tool: Full single document info.
 *
 * Returns all summary fields plus OCR text (ocrText), tags,
 * ordner, and version info. The ocrText field is truncated
 * to 2000 chars to prevent token bloat.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadDokumenteDetailTool(ctx: ToolContext) {
  return tool({
    description:
      "Read full details of a single Dokument including OCR text content. Requires a dokumentId. Returns name, status, mimeType, size, OCR text (truncated), tags, and metadata.",
    parameters: z.object({
      dokumentId: z.string().describe("The document ID to read."),
    }),
    execute: async ({ dokumentId }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const dokument = await ctx.prisma.dokument.findUnique({
        where: { id: dokumentId },
        select: {
          id: true,
          akteId: true,
          name: true,
          status: true,
          mimeType: true,
          groesse: true,
          version: true,
          ocrText: true,
          ocrStatus: true,
          tags: true,
          ordner: true,
          erstelltDurch: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!dokument) {
        return {
          error: "Dokument nicht gefunden.",
          source: { table: "dokument" },
        };
      }

      // RBAC: verify user has access to the parent Akte
      const akteAccess = await ctx.prisma.akte.findFirst({
        where: { id: dokument.akteId, ...ctx.akteAccessFilter },
        select: { id: true },
      });

      if (!akteAccess) {
        return {
          error: "Kein Zugriff auf das Dokument.",
          source: { table: "dokument" },
        };
      }

      // Truncate OCR text to 2000 chars
      const ocrText =
        dokument.ocrText && dokument.ocrText.length > 2000
          ? dokument.ocrText.slice(0, 2000) + "..."
          : dokument.ocrText;

      return {
        data: {
          id: dokument.id,
          akteId: dokument.akteId,
          name: dokument.name,
          status: dokument.status,
          mimeType: dokument.mimeType,
          groesse: dokument.groesse,
          version: dokument.version,
          ocrText,
          ocrStatus: dokument.ocrStatus,
          tags: dokument.tags,
          ordner: dokument.ordner,
          erstelltDurch: dokument.erstelltDurch,
          createdAt: dokument.createdAt.toISOString(),
          updatedAt: dokument.updatedAt.toISOString(),
        },
        source: { table: "dokument", id: dokument.id },
      };
    },
  });
}
