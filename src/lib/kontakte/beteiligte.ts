/**
 * Contract between the "Beteiligten hinzufügen" dialog and
 * POST /api/akten/[id]/beteiligte + GET /api/akten/[id]/conflict-check.
 * Client-safe (zod only).
 */
import { z } from "zod";

export const BETEILIGTEN_ROLLEN = [
  { value: "MANDANT", label: "Mandant" },
  { value: "GEGNER", label: "Gegner" },
  { value: "GEGNERVERTRETER", label: "Gegnervertreter" },
  { value: "GERICHT", label: "Gericht" },
  { value: "ZEUGE", label: "Zeuge" },
  { value: "SACHVERSTAENDIGER", label: "Sachverständiger" },
  { value: "SONSTIGER", label: "Sonstiger" },
] as const;

export type BeteiligtenRolle = (typeof BETEILIGTEN_ROLLEN)[number]["value"];

const ROLLEN_VALUES = BETEILIGTEN_ROLLEN.map((r) => r.value) as [BeteiligtenRolle, ...BeteiligtenRolle[]];

export const addBeteiligterSchema = z.object({
  kontaktId: z.string().min(1, "Kontakt ist erforderlich"),
  rolle: z.enum(ROLLEN_VALUES),
  notizen: z.string().optional(),
});

export type AddBeteiligterBody = z.infer<typeof addBeteiligterSchema>;

export const conflictCheckQuerySchema = z.object({
  kontaktId: z.string().min(1),
  rolle: z.enum(ROLLEN_VALUES),
});

export function beteiligteUrl(akteId: string): string {
  return `/api/akten/${encodeURIComponent(akteId)}/beteiligte`;
}

export function conflictCheckUrl(akteId: string, kontaktId: string, rolle: BeteiligtenRolle): string {
  const p = new URLSearchParams({ kontaktId, rolle });
  return `/api/akten/${encodeURIComponent(akteId)}/conflict-check?${p}`;
}
