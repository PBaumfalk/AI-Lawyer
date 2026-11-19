/**
 * Anlage-Vertrag für POST /api/kalender.
 *
 * Das Schema wird von der Route validiert; der Builder erzeugt aus den
 * Formularwerten des Kalender-Dialogs genau diese Nutzlast. Weicht eines von
 * beidem ab, meldet TypeScript den Bruch.
 */
import { z } from "zod";

export const createKalenderSchema = z.object({
  typ: z.enum(["TERMIN", "FRIST", "WIEDERVORLAGE"]),
  titel: z.string().min(1, "Titel ist erforderlich"),
  beschreibung: z.string().nullable().optional(),
  datum: z.string().datetime({ message: "Ungueltiges Datumsformat" }),
  datumBis: z.string().datetime().nullable().optional(),
  ganztaegig: z.boolean().optional(),
  akteId: z.string().nullable().optional(),
  verantwortlichId: z.string().min(1, "Verantwortlicher ist erforderlich"),
  fristablauf: z.string().datetime().nullable().optional(),
  vorfrist: z.string().datetime().nullable().optional(),
  // Enhanced Frist fields
  prioritaet: z
    .enum(["SEHR_NIEDRIG", "NIEDRIG", "NORMAL", "HOCH", "DRINGEND"])
    .optional()
    .default("NORMAL"),
  fristArt: z.enum(["EREIGNISFRIST", "BEGINNFRIST"]).nullable().optional(),
  bundesland: z.string().nullable().optional(),
  istNotfrist: z.boolean().optional().default(false),
  vorfristen: z.array(z.string().datetime()).optional(),
  halbfrist: z.string().datetime().nullable().optional(),
  sachbearbeiterId: z.string().nullable().optional(),
  dokumentIds: z.array(z.string()).optional(),
  sonderfall: z
    .enum(["OEFFENTLICHE_ZUSTELLUNG", "AUSLANDSZUSTELLUNG_EU"])
    .nullable()
    .optional(),
  hauptfristId: z.string().nullable().optional(),
});

export type KalenderErstellenRequest = z.input<typeof createKalenderSchema>;

/** Formularwerte des Kalender-Dialogs (Datumsfelder als Inhalt von <input type="date|datetime-local">). */
export interface KalenderFormWerte {
  typ: "TERMIN" | "FRIST" | "WIEDERVORLAGE";
  titel: string;
  beschreibung: string;
  datum: string;
  datumBis: string;
  ganztaegig: boolean;
  akteId: string;
  verantwortlichId: string;
  fristablauf: string;
  vorfrist: string;
}

/** Zusatzfelder einer Frist, die nicht im Formular stehen (z. B. aus dem Fristenrechner). */
export interface FristZusatz {
  istNotfrist?: boolean;
  fristArt?: "EREIGNISFRIST" | "BEGINNFRIST" | null;
  bundesland?: string | null;
  sonderfall?: "OEFFENTLICHE_ZUSTELLUNG" | "AUSLANDSZUSTELLUNG_EU" | null;
  /** Datumsfelder (yyyy-MM-dd) */
  vorfristen?: string[];
  halbfrist?: string | null;
}

/**
 * Wandelt den Inhalt eines Datums-/Datum-Zeit-Feldes in ISO um, wie der
 * Dialog es immer getan hat (yyyy-MM-dd → UTC-Mitternacht, datetime-local →
 * lokale Zeit).
 */
export function datumsfeldZuIso(wert: string): string {
  return new Date(wert).toISOString();
}

export function buildKalenderPayload(
  data: KalenderFormWerte,
  zusatz?: FristZusatz | null,
): KalenderErstellenRequest {
  const istFrist = data.typ === "FRIST";
  const payload: KalenderErstellenRequest = {
    typ: data.typ,
    titel: data.titel.trim(),
    beschreibung: data.beschreibung.trim() || null,
    datum: datumsfeldZuIso(data.datum),
    datumBis: data.typ === "TERMIN" && data.datumBis ? datumsfeldZuIso(data.datumBis) : null,
    ganztaegig: data.ganztaegig,
    akteId: data.akteId || null,
    verantwortlichId: data.verantwortlichId,
    fristablauf: istFrist && data.fristablauf ? datumsfeldZuIso(data.fristablauf) : null,
    vorfrist: istFrist && data.vorfrist ? datumsfeldZuIso(data.vorfrist) : null,
  };
  if (istFrist && zusatz) {
    if (zusatz.istNotfrist !== undefined) payload.istNotfrist = zusatz.istNotfrist;
    if (zusatz.fristArt) payload.fristArt = zusatz.fristArt;
    if (zusatz.bundesland) payload.bundesland = zusatz.bundesland;
    if (zusatz.sonderfall) payload.sonderfall = zusatz.sonderfall;
    if (zusatz.vorfristen?.length) payload.vorfristen = zusatz.vorfristen.map(datumsfeldZuIso);
    if (zusatz.halbfrist) payload.halbfrist = datumsfeldZuIso(zusatz.halbfrist);
  }
  return payload;
}
