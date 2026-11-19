// Aktenkonto API contract shared by /api/finanzen/aktenkonto/[akteId]* routes
// and aktenkonto-ledger.tsx. Client-safe: only zod, types and pure functions.

import { z } from 'zod';

export const BUCHUNGS_TYPEN = ['EINNAHME', 'AUSGABE', 'FREMDGELD', 'AUSLAGE'] as const;
export type BuchungsTypDto = (typeof BUCHUNGS_TYPEN)[number];

export const KONTO_TYPEN = ['GESCHAEFT', 'ANDERKONTO'] as const;

/**
 * Direction of a Fremdgeld booking: EINGANG = money received for the client
 * (starts the 5-Werktage forwarding deadline), AUSGANG = forwarding to the
 * client / third party (settles open Eingaenge). Ignored for other types.
 */
export const FREMDGELD_RICHTUNG = ['EINGANG', 'AUSGANG'] as const;
export type FremdgeldRichtung = (typeof FREMDGELD_RICHTUNG)[number];

export const bookingSchema = z
  .object({
    buchungstyp: z.enum(BUCHUNGS_TYPEN),
    betrag: z.number().positive('Betrag muss positiv sein'),
    verwendungszweck: z.string().trim().min(1, 'Verwendungszweck ist erforderlich'),
    buchungsdatum: z.string().optional(), // ISO date string
    kostenstelle: z.string().optional(),
    konto: z.enum(KONTO_TYPEN).optional(),
    dokumentId: z.string().optional(),
    richtung: z.enum(FREMDGELD_RICHTUNG).optional(),
  })
  .refine((b) => b.richtung === undefined || b.buchungstyp === 'FREMDGELD', {
    message: 'Richtung ist nur bei Fremdgeld zulaessig',
    path: ['richtung'],
  });
export type BookingBody = z.infer<typeof bookingSchema>;

/** Choices of the "Neue Buchung" dialog; Fremdgeld is split by direction. */
export const BUCHUNGS_ARTEN = {
  EINNAHME: { label: 'Einnahme', buchungstyp: 'EINNAHME' },
  AUSGABE: { label: 'Ausgabe', buchungstyp: 'AUSGABE' },
  FREMDGELD_EINGANG: { label: 'Fremdgeld-Eingang', buchungstyp: 'FREMDGELD', richtung: 'EINGANG' },
  FREMDGELD_AUSGANG: { label: 'Fremdgeld-Weiterleitung', buchungstyp: 'FREMDGELD', richtung: 'AUSGANG' },
  AUSLAGE: { label: 'Auslage', buchungstyp: 'AUSLAGE' },
} as const satisfies Record<string, { label: string; buchungstyp: BuchungsTypDto; richtung?: FremdgeldRichtung }>;
export type BuchungsArt = keyof typeof BUCHUNGS_ARTEN;

export function buildBookingBody(input: {
  art: BuchungsArt;
  betrag: number;
  verwendungszweck: string;
  konto?: (typeof KONTO_TYPEN)[number];
}): BookingBody {
  const art = BUCHUNGS_ARTEN[input.art];
  return {
    buchungstyp: art.buchungstyp,
    betrag: input.betrag,
    verwendungszweck: input.verwendungszweck.trim(),
    ...(input.konto && { konto: input.konto }),
    ...('richtung' in art && { richtung: art.richtung }),
  };
}

export const stornoSchema = z.object({
  buchungId: z.string().min(1, 'Buchungs-ID ist erforderlich'),
  grund: z.string().trim().min(1, 'Stornogrund ist erforderlich'),
});
export type StornoBody = z.infer<typeof stornoSchema>;

export function buildStornoBody(buchungId: string, grund: string): StornoBody {
  return { buchungId, grund: grund.trim() };
}

/** One ledger row as returned by GET /api/finanzen/aktenkonto/[akteId]. */
export interface AktenkontoBuchungDto {
  id: string;
  buchungstyp: BuchungsTypDto;
  betrag: number;
  verwendungszweck: string;
  buchungsdatum: string;
  kostenstelle: string | null;
  konto: string;
  dokumentId: string | null;
  rechnungId: string | null;
  fremdgeldFrist: string | null;
  /** Set on a Storno entry: the booking it reverses. */
  stornoVon: string | null;
  stornoGrund: string | null;
  /** Set on a reversed booking: the Storno entry that reverses it. */
  storniertDurch: string | null;
  laufenderSaldo: number;
}
