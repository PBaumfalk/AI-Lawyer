/**
 * Gemeinsamer Vertrag für das Erledigen von Kalendereinträgen.
 *
 * Wird von PATCH /api/kalender/[id]/erledigt UND von allen Oberflächen
 * (Kalenderliste, Akte-Kalender-Tab, Tagesübersicht) verwendet, damit die
 * Oberfläche genau die Gründe abfragt, die die Route verlangt.
 *
 * Fachliche Regeln (haftungsrelevant, nicht abschwächen):
 * - FRIST erledigen: Erledigungsgrund zwingend.
 * - FRIST erledigen nach Fristablauf: zusätzlich Überschreitungsgrund zwingend.
 * - Fristablauf: Eine Frist endet mit Ablauf ihres letzten Tages
 *   (§ 188 Abs. 1 BGB, § 222 Abs. 1 ZPO). Überfällig ist sie also erst ab dem
 *   Folgetag – maßgeblich ist der Kalendertag in der Zeitzone der Kanzlei
 *   (Europe/Berlin), nicht die Uhrzeit des gespeicherten Datums.
 */
import { z } from "zod";

export const KANZLEI_ZEITZONE = "Europe/Berlin";

export const erledigtRequestSchema = z.object({
  erledigt: z.boolean(),
  erledigungsgrund: z.string().optional(),
  ueberschreitungsgrund: z.string().optional(),
});

export type ErledigtRequest = z.infer<typeof erledigtRequestSchema>;

export interface ErledigbarerEintrag {
  typ: string;
  datum: Date | string;
}

export interface ErledigungsAnforderungen {
  erledigungsgrund: boolean;
  ueberschreitungsgrund: boolean;
}

const tagFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: KANZLEI_ZEITZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalendertag (yyyy-mm-dd) eines Zeitpunkts in der Kanzlei-Zeitzone. */
export function kanzleiTag(d: Date | string): string {
  return tagFormat.format(typeof d === "string" ? new Date(d) : d);
}

/** Frist ist überfällig, wenn ihr letzter Tag vollständig abgelaufen ist. */
export function istFristUeberfaellig(datum: Date | string, now: Date = new Date()): boolean {
  return kanzleiTag(datum) < kanzleiTag(now);
}

/** Welche Gründe verlangt das Erledigen dieses Eintrags? */
export function erledigungsAnforderungen(
  eintrag: ErledigbarerEintrag,
  now: Date = new Date(),
): ErledigungsAnforderungen {
  const istFrist = eintrag.typ === "FRIST";
  return {
    erledigungsgrund: istFrist,
    ueberschreitungsgrund: istFrist && istFristUeberfaellig(eintrag.datum, now),
  };
}

/** Kann ohne Rückfrage erledigt werden (kein Grund verlangt)? */
export function erledigenOhneRueckfrage(eintrag: ErledigbarerEintrag, now: Date = new Date()): boolean {
  const a = erledigungsAnforderungen(eintrag, now);
  return !a.erledigungsgrund && !a.ueberschreitungsgrund;
}

/**
 * Prüft eine Anfrage gegen die Anforderungen. Gibt die Fehlermeldung zurück
 * oder null, wenn die Anfrage zulässig ist.
 */
export function pruefeErledigung(
  eintrag: ErledigbarerEintrag,
  anfrage: ErledigtRequest,
  now: Date = new Date(),
): string | null {
  if (!anfrage.erledigt) return null;
  const a = erledigungsAnforderungen(eintrag, now);
  if (a.erledigungsgrund && !anfrage.erledigungsgrund?.trim()) {
    return "Für Fristen ist ein Erledigungsgrund zwingend erforderlich";
  }
  if (a.ueberschreitungsgrund && !anfrage.ueberschreitungsgrund?.trim()) {
    return "Für überfällige Fristen ist ein Überschreitungsgrund erforderlich";
  }
  return null;
}

/** Baut die Nutzlast für PATCH /api/kalender/[id]/erledigt. */
export function buildErledigtRequest(
  erledigt: boolean,
  gruende: { erledigungsgrund?: string; ueberschreitungsgrund?: string } = {},
): ErledigtRequest {
  if (!erledigt) return { erledigt: false };
  const req: ErledigtRequest = { erledigt: true };
  const eg = gruende.erledigungsgrund?.trim();
  const ug = gruende.ueberschreitungsgrund?.trim();
  if (eg) req.erledigungsgrund = eg;
  if (ug) req.ueberschreitungsgrund = ug;
  return req;
}
