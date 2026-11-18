/**
 * Body of POST /api/vorlagen/[id]/generieren, shared by the wizard and the
 * route (the wizard sent `customFelder` while the route read
 * `customFelderValues`, and "Kein Briefkopf" was indistinguishable from
 * "Standard-Briefkopf"). Client-safe.
 */
import { z } from "zod";

export const vorlageGenerierenSchema = z.object({
  akteId: z.string().min(1, "akteId ist erforderlich"),
  customFelderValues: z.record(z.string()).optional(),
  /**
   * string = this Briefkopf, null = explicitly none ("Kein Briefkopf"),
   * omitted = the Standard-Briefkopf (if one exists).
   */
  briefkopfId: z.string().min(1).nullable().optional(),
  openInEditor: z.boolean().optional(),
  targetOrdner: z.string().optional(),
  dateiname: z.string().optional(),
});

export type VorlageGenerierenBody = z.infer<typeof vorlageGenerierenSchema>;

export function vorlageGenerierenUrl(vorlageId: string): string {
  return `/api/vorlagen/${encodeURIComponent(vorlageId)}/generieren`;
}
