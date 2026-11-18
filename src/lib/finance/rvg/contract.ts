// RVG API contract shared by /api/finanzen/rvg routes and rvg-calculator.tsx.
// Client-safe: only zod, types and pure functions.

import { z } from 'zod';
import type { CalculationResult, PositionOptions } from './types';
import type { CreateInvoiceInput } from '../invoice/contract';

export const rvgPositionSchema = z.object({
  vvNr: z.string().min(1),
  rate: z.number().optional(),
  gegenstandswert: z.number().optional(),
  anzahlAuftraggeber: z.number().optional(),
  betrag: z.number().optional(),
  km: z.number().optional(),
  tage: z.number().optional(),
});
export type RvgPositionInput = z.infer<typeof rvgPositionSchema>;

/** Body of POST /api/finanzen/rvg/[akteId] (save calculation for an Akte). */
export const rvgSaveSchema = z.object({
  streitwert: z.number().positive('Streitwert muss positiv sein'),
  auftragseingang: z.string().datetime().optional(),
  positionen: z.array(rvgPositionSchema).min(1, 'Mindestens eine VV-Position erforderlich'),
  autoAnrechnung: z.boolean().optional().default(true),
  autoAuslagen: z.boolean().optional().default(true),
  autoUst: z.boolean().optional().default(true),
});
export type RvgSaveBody = z.input<typeof rvgSaveSchema>;

/** Body of POST /api/finanzen/rvg (calculate, optionally save). */
export const rvgCalculateSchema = rvgSaveSchema.extend({
  akteId: z.string().optional(),
  speichern: z.boolean().optional().default(false),
});

/** Turn parsed API positions into the calculator's {nr, options} input. */
export function toCalculatorPositions(positionen: RvgPositionInput[]) {
  return positionen.map(({ vvNr, ...options }) => ({ nr: vvNr, options }));
}

/**
 * Build the save request from the calculator's local state. The flags must be
 * sent, otherwise the server would recalculate with its defaults and store a
 * different result than the one shown on screen.
 */
export function buildRvgSaveBody(input: {
  streitwert: number;
  positions: { vvNr: string; options: PositionOptions }[];
  autoAuslagen: boolean;
  autoUst: boolean;
}): RvgSaveBody {
  return {
    streitwert: input.streitwert,
    positionen: input.positions.map((p) => ({
      vvNr: p.vvNr,
      rate: p.options.rate,
      gegenstandswert: p.options.gegenstandswert,
      anzahlAuftraggeber: p.options.anzahlAuftraggeber,
      betrag: p.options.betrag,
      km: p.options.km,
      tage: p.options.tage,
    })),
    autoAuslagen: input.autoAuslagen,
    autoUst: input.autoUst,
  };
}

const UST_VV_NR = '7008';
const UST_SATZ = 19;

/**
 * Invoice draft from an RVG calculation.
 *
 * VV 7008 (Umsatzsteuer) is not an invoice line: the invoice computes USt
 * itself from each line's ustSatz. Keeping 7008 as a line would charge the tax
 * twice. If the calculation has no 7008 (USt switched off), lines get 0 %.
 */
export function buildInvoiceFromRvg(
  ergebnis: Pick<CalculationResult, 'items'>,
  ctx: { akteId: string; rvgBerechnungId?: string },
): CreateInvoiceInput {
  const mitUst = ergebnis.items.some((i) => i.vvNr === UST_VV_NR);
  return {
    akteId: ctx.akteId,
    typ: 'RVG',
    ...(ctx.rvgBerechnungId && { rvgBerechnungId: ctx.rvgBerechnungId }),
    positionen: ergebnis.items
      .filter((i) => i.vvNr !== UST_VV_NR)
      .map((item) => ({
        vvNr: item.vvNr,
        beschreibung: item.name + (item.notes ? ` (${item.notes})` : ''),
        menge: 1,
        einzelpreis: item.finalAmount,
        ustSatz: mitUst ? UST_SATZ : 0,
        betrag: item.finalAmount,
      })),
  };
}

/** Response of POST /api/finanzen/rvg/[akteId]. */
export interface RvgSaveResponse {
  berechnung: { id: string; uebernehmenAlsRechnung: CreateInvoiceInput };
  ergebnis: CalculationResult;
}
