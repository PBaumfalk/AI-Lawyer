/**
 * create_alert tool: Create a Helena alert.
 *
 * Creates a HelenaAlert directly (alerts ARE the output, not drafts).
 * Alerts notify users about important case developments.
 */

import { tool } from "ai";
import { z } from "zod";
import type { HelenaAlertTyp } from "@prisma/client";
import type { ToolContext, ToolResult } from "../types";

const ALERT_TYPES: HelenaAlertTyp[] = [
  "FRIST_KRITISCH",
  "AKTE_INAKTIV",
  "BETEILIGTE_FEHLEN",
  "DOKUMENT_FEHLT",
  "WIDERSPRUCH",
  "NEUES_URTEIL",
];

export function createCreateAlertTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a Helena alert (Warnung/Hinweis) for an Akte. Alerts are created directly (not as drafts) and notify the responsible user. Types: FRIST_KRITISCH, AKTE_INAKTIV, BETEILIGTE_FEHLEN, DOKUMENT_FEHLT, WIDERSPRUCH, NEUES_URTEIL.",
    parameters: z.object({
      typ: z
        .enum([
          "FRIST_KRITISCH",
          "AKTE_INAKTIV",
          "BETEILIGTE_FEHLEN",
          "DOKUMENT_FEHLT",
          "WIDERSPRUCH",
          "NEUES_URTEIL",
        ])
        .describe("Alert type from HelenaAlertTyp enum."),
      titel: z.string().describe("Alert title (short, descriptive)."),
      inhalt: z
        .string()
        .optional()
        .describe("Detailed alert description."),
      severity: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Severity level 1-10 (default 5). Higher = more severe."),
      akteId: z
        .string()
        .optional()
        .describe("Akte ID. Defaults to current Akte context if omitted."),
    }),
    execute: async ({
      typ,
      titel,
      inhalt,
      severity,
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

      if (!ALERT_TYPES.includes(typ as HelenaAlertTyp)) {
        return { error: `Ungueltiger Alert-Typ: ${typ}` };
      }

      const alert = await ctx.prisma.helenaAlert.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: typ as HelenaAlertTyp,
          titel,
          inhalt: inhalt ?? null,
          severity: severity ?? 5,
          prioritaet: severity ?? 5,
        },
      });

      return {
        data: {
          alertId: alert.id,
          typ,
          titel,
          severity: alert.severity,
        },
        source: { table: "helena_alerts", id: alert.id },
      };
    },
  });
}
