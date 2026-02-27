/**
 * get_kosten_rules tool: RVG fee calculation.
 *
 * Computes German legal fees (RVG) for a given Streitwert.
 * Supports single fee lookup or full calculation with
 * multiple VV positions.
 */

import { tool } from "ai";
import { z } from "zod";
import {
  computeRvgFee,
  buildCalculation,
} from "@/lib/finance/rvg/calculator";
import type { ToolContext, ToolResult } from "../types";

export function createGetKostenRulesTool(ctx: ToolContext) {
  return tool({
    description:
      "Calculate German legal fees (RVG/Rechtsanwaltsverguetungsgesetz) for a given Streitwert. Can compute a single fee with a rate, or a full calculation with multiple VV positions (e.g. 3100, 3104). Automatically applies Anrechnung, Auslagenpauschale (VV 7002), and USt (VV 7008).",
    parameters: z.object({
      streitwert: z
        .number()
        .describe("The disputed amount (Streitwert/Gegenstandswert) in EUR."),
      positionen: z
        .array(z.string())
        .optional()
        .describe(
          'VV position numbers for a full calculation (e.g. ["3100", "3104"]). If omitted, returns a single base fee at rate 1.0.',
        ),
      rate: z
        .number()
        .optional()
        .describe(
          "Fee rate for single-fee calculation (e.g. 1.3). Only used when positionen is not provided.",
        ),
    }),
    execute: async ({ streitwert, positionen, rate }): Promise<ToolResult> => {
      if (ctx.abortSignal?.aborted) {
        return { error: "Abgebrochen." };
      }

      if (streitwert <= 0) {
        return { error: "Streitwert muss groesser als 0 sein." };
      }

      try {
        if (positionen && positionen.length > 0) {
          // Full calculation with multiple positions
          const result = buildCalculation(
            streitwert,
            positionen.map((nr) => ({ nr })),
          );

          return {
            data: {
              streitwert,
              positionen: result.items.map((item) => ({
                vvNr: item.vvNr,
                name: item.name,
                rate: item.rate,
                betrag: item.finalAmount,
                anmerkung: item.notes ?? null,
              })),
              anrechnung: result.anrechnung
                ? {
                    von: result.anrechnung.sourceNr,
                    auf: result.anrechnung.targetNr,
                    betrag: result.anrechnung.creditAmount,
                    beschreibung: result.anrechnung.description,
                  }
                : null,
              nettoGesamt: result.nettoGesamt,
              ustBetrag: result.ustBetrag,
              bruttoGesamt: result.bruttoGesamt,
              gebuehrenTabelle: result.feeTableVersion,
              hinweise: result.notices,
            },
            source: { table: "rvg_vv_katalog" },
          };
        }

        // Single fee calculation
        const feeRate = rate ?? 1.0;
        const fee = computeRvgFee(streitwert, feeRate);

        return {
          data: {
            streitwert,
            rate: feeRate,
            gebuehr: fee,
          },
          source: { table: "rvg_vv_katalog" },
        };
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : "Berechnungsfehler";
        return { error: msg };
      }
    },
  });
}
