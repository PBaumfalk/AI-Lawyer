/**
 * create_draft_zeiterfassung tool: Create a draft time entry.
 *
 * Creates a HelenaDraft with typ=NOTIZ and meta.subtype="zeiterfassung"
 * (HelenaDraftTyp has no ZEITERFASSUNG value -- uses NOTIZ as carrier).
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";
import { notifyDraftCreated } from "@/lib/helena/draft-notification";

export function createCreateDraftZeiterfassungTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a draft time tracking entry (Zeiterfassung) for an Akte. The draft requires user approval before becoming a real time entry.",
    parameters: z.object({
      beschreibung: z
        .string()
        .describe("Description of the work performed."),
      dauer: z
        .number()
        .describe("Duration in minutes."),
      datum: z
        .string()
        .optional()
        .describe(
          "Date in ISO 8601 format (e.g. 2026-03-15). Defaults to today.",
        ),
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
    }),
    execute: async ({
      beschreibung,
      dauer,
      datum,
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

      if (dauer <= 0) {
        return { error: "Dauer muss groesser als 0 Minuten sein." };
      }

      const effectiveDatum = datum ?? new Date().toISOString().split("T")[0];

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "NOTIZ", // No ZEITERFASSUNG in HelenaDraftTyp enum
          status: "PENDING",
          titel: `Zeiterfassung: ${beschreibung.slice(0, 60)}`,
          inhalt: beschreibung,
          meta: {
            subtype: "zeiterfassung",
            dauer,
            datum: effectiveDatum,
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
          typ: "NOTIZ",
          beschreibung,
          dauer,
          datum: effectiveDatum,
          status: "PENDING",
        },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
