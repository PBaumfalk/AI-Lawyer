/**
 * create_draft_dokument tool: Create a draft document.
 *
 * Creates a HelenaDraft with typ=DOKUMENT and status=PENDING.
 * The draft requires user approval before becoming a real Dokument.
 */

import { tool } from "ai";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { ToolContext, ToolResult } from "../types";

export function createCreateDraftDokumentTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a draft document (Entwurf) for an Akte. Content is stored as markdown. The draft requires user approval before becoming a real Dokument. Returns the draft ID for reference.",
    parameters: z.object({
      titel: z.string().describe("Document title in German."),
      inhalt: z
        .string()
        .describe("Document content as markdown."),
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
      meta: z
        .record(z.unknown())
        .optional()
        .describe("Additional metadata (JSON object)."),
    }),
    execute: async ({ titel, inhalt, akteId: inputAkteId, meta }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetAkteId = inputAkteId ?? ctx.akteId;
      if (!targetAkteId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "DOKUMENT",
          status: "PENDING",
          titel,
          inhalt,
          meta: (meta as Prisma.InputJsonValue) ?? undefined,
        },
      });

      return {
        data: {
          draftId: draft.id,
          typ: "DOKUMENT",
          titel,
          status: "PENDING",
        },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
