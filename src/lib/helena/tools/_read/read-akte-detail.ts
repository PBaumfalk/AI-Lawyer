/**
 * read_akte_detail tool: Full Akte record with all details.
 *
 * Returns everything from read_akte plus beteiligte list,
 * linked normen, notizen, and falldaten.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../types";

export function createReadAkteDetailTool(ctx: ToolContext) {
  return tool({
    description:
      "Read full details of an Akte: all summary fields plus Beteiligte list, Notizen, Falldaten, Wegen, and linked Normen. Use this when you need complete case information.",
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
        include: {
          anwalt: { select: { id: true, name: true } },
          sachbearbeiter: { select: { id: true, name: true } },
          beteiligte: {
            select: {
              id: true,
              rolle: true,
              notizen: true,
              kontakt: {
                select: {
                  id: true,
                  nachname: true,
                  vorname: true,
                  firma: true,
                  email: true,
                },
              },
            },
            take: 50,
          },
          normen: {
            select: {
              id: true,
              gesetzKuerzel: true,
              paragraphNr: true,
              anmerkung: true,
            },
            take: 20,
          },
          _count: {
            select: {
              dokumente: true,
              kalenderEintraege: true,
              beteiligte: true,
              zeiterfassungen: true,
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

      // Truncate notizen to 2000 chars
      const notizen =
        akte.notizen && akte.notizen.length > 2000
          ? akte.notizen.slice(0, 2000) + "..."
          : akte.notizen;

      return {
        data: {
          id: akte.id,
          aktenzeichen: akte.aktenzeichen,
          kurzrubrum: akte.kurzrubrum,
          wegen: akte.wegen,
          sachgebiet: akte.sachgebiet,
          status: akte.status,
          gegenstandswert: akte.gegenstandswert?.toString() ?? null,
          falldaten: akte.falldaten,
          notizen,
          angelegt: akte.angelegt.toISOString(),
          geaendert: akte.geaendert.toISOString(),
          anwalt: akte.anwalt
            ? { id: akte.anwalt.id, name: akte.anwalt.name }
            : null,
          sachbearbeiter: akte.sachbearbeiter
            ? { id: akte.sachbearbeiter.id, name: akte.sachbearbeiter.name }
            : null,
          beteiligte: akte.beteiligte.map((b) => ({
            id: b.id,
            rolle: b.rolle,
            nachname: b.kontakt.nachname,
            vorname: b.kontakt.vorname,
            firma: b.kontakt.firma,
            email: b.kontakt.email,
            notizen: b.notizen,
          })),
          normen: akte.normen.map((n) => ({
            gesetzKuerzel: n.gesetzKuerzel,
            paragraphNr: n.paragraphNr,
            anmerkung: n.anmerkung,
          })),
          counts: {
            dokumente: akte._count.dokumente,
            fristen: akte._count.kalenderEintraege,
            beteiligte: akte._count.beteiligte,
            zeiterfassungen: akte._count.zeiterfassungen,
          },
        },
        source: { table: "akte", id: akte.id },
      };
    },
  });
}
