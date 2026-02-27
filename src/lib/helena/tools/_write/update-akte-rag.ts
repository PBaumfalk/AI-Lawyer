/**
 * update_akte_rag tool: Propose Akte field updates.
 *
 * Creates a HelenaDraft with typ=DOKUMENT containing the proposed
 * field updates in the meta field. Does NOT update the Akte directly.
 * Only available to ADMIN and ANWALT roles.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";
import { notifyDraftCreated } from "@/lib/helena/draft-notification";

export function createUpdateAkteRagTool(ctx: ToolContext) {
  return tool({
    description:
      "Propose updates to Akte fields (Sachgebiet, summary, tags). Creates a draft proposal that requires approval before the Akte is modified. Only for ADMIN/ANWALT.",
    parameters: z.object({
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
      updates: z.object({
        sachgebiet: z
          .string()
          .optional()
          .describe("Proposed Sachgebiet change (e.g. ARBEITSRECHT, FAMILIENRECHT)."),
        summary: z
          .string()
          .optional()
          .describe("Proposed summary/Kurzrubrum update."),
        wegen: z
          .string()
          .optional()
          .describe("Proposed 'wegen' (subject matter) update."),
        notizen: z
          .string()
          .optional()
          .describe("Proposed notes to append."),
      }).describe("Object with optional fields to update."),
    }),
    execute: async ({ akteId: inputAkteId, updates }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetAkteId = inputAkteId ?? ctx.akteId;
      if (!targetAkteId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      // Check that at least one update is proposed
      const hasUpdates = Object.values(updates).some(
        (v) => v !== undefined && v !== null,
      );
      if (!hasUpdates) {
        return { error: "Keine Aenderungen vorgeschlagen." };
      }

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "DOKUMENT",
          status: "PENDING",
          titel: "Vorgeschlagene Akten-Aktualisierung",
          inhalt: Object.entries(updates)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `**${k}:** ${v}`)
            .join("\n"),
          meta: {
            subtype: "akte_update",
            proposedUpdates: updates,
          },
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
          typ: "DOKUMENT",
          proposedUpdates: updates,
          status: "PENDING",
        },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
