/**
 * create_draft_frist tool: Create a draft deadline/appointment.
 *
 * Creates a HelenaDraft with typ=FRIST and status=PENDING.
 * The meta field contains the deadline details (datum, typ, beschreibung).
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createCreateDraftFristTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a draft deadline (Frist), appointment (Termin), or follow-up (Wiedervorlage). The draft requires user approval before becoming a real KalenderEintrag.",
    parameters: z.object({
      titel: z.string().describe("Title of the deadline/appointment."),
      datum: z
        .string()
        .describe("Due date in ISO 8601 format (e.g. 2026-03-15)."),
      typ: z
        .enum(["FRIST", "TERMIN", "WIEDERVORLAGE"])
        .describe("Type: FRIST (deadline), TERMIN (appointment), or WIEDERVORLAGE (follow-up)."),
      beschreibung: z
        .string()
        .optional()
        .describe("Optional description of the deadline."),
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
    }),
    execute: async ({
      titel,
      datum,
      typ,
      beschreibung,
      akteId: inputAkteId,
    }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      const targetAkteId = inputAkteId ?? ctx.akteId;
      if (!targetAkteId) {
        return {
          error: "Keine Akte angegeben und kein Akte-Kontext vorhanden.",
        };
      }

      // Validate date format
      const parsedDate = new Date(datum);
      if (isNaN(parsedDate.getTime())) {
        return { error: "Ungueltiges Datum. Bitte ISO-Format verwenden (z.B. 2026-03-15)." };
      }

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "FRIST",
          status: "PENDING",
          titel,
          inhalt: beschreibung ?? "",
          meta: {
            datum,
            kalenderTyp: typ,
            beschreibung: beschreibung ?? null,
          },
        },
      });

      return {
        data: {
          draftId: draft.id,
          typ: "FRIST",
          titel,
          datum,
          kalenderTyp: typ,
          status: "PENDING",
        },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
