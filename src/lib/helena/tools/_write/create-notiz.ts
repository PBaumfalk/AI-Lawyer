/**
 * create_notiz tool: Create a note (Notiz).
 *
 * Creates a HelenaDraft with typ=NOTIZ and status=PENDING.
 * Notes can be Akte-bound or general (no akteId).
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";
import { notifyDraftCreated } from "@/lib/helena/draft-notification";

export function createCreateNotizTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a note (Notiz) for an Akte or as a general note. Notes are stored as drafts requiring approval.",
    parameters: z.object({
      inhalt: z.string().describe("Note content (text or markdown)."),
      akteId: z
        .string()
        .optional()
        .describe(
          "Akte ID. Defaults to current Akte context. If no Akte context exists, a general note is created.",
        ),
    }),
    execute: async ({ inhalt, akteId: inputAkteId }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetAkteId = inputAkteId ?? ctx.akteId;

      // HelenaDraft requires akteId (non-nullable FK in schema)
      // For general notes without Akte context, we need an akteId
      if (!targetAkteId) {
        return {
          error:
            "Keine Akte angegeben und kein Akte-Kontext vorhanden. Notizen benoetigen eine Akte.",
        };
      }

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "NOTIZ",
          status: "PENDING",
          titel: inhalt.length > 80 ? inhalt.slice(0, 77) + "..." : inhalt,
          inhalt,
        },
      });

      // Resolve Akte owner for notification recipients
      const akte = await ctx.prisma.akte.findUnique({
        where: { id: targetAkteId },
        select: { anwaltId: true, sachbearbeiterId: true },
      });
      const akteAnwaltId = akte?.anwaltId ?? akte?.sachbearbeiterId ?? null;

      // Fire-and-forget: notification failure must not fail the tool
      notifyDraftCreated(
        { id: draft.id, akteId: targetAkteId, userId: ctx.userId, typ: draft.typ, titel: draft.titel },
        akteAnwaltId,
      ).catch(() => {});

      return {
        data: {
          draftId: draft.id,
          typ: "NOTIZ",
          status: "PENDING",
        },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
