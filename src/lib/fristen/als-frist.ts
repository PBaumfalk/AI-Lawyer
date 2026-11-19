/**
 * Fristenrechner → Kalender: Vorbelegung des Kalender-Dialogs aus der Antwort
 * von POST /api/fristen/rechner (Vorwärtsberechnung).
 *
 * Datumswerte werden als Kalendertag (yyyy-MM-dd) in der Zeitzone des Browsers
 * übernommen – also genau der Tag, den der Fristenrechner anzeigt.
 */
import { format } from "date-fns";
import type { FristZusatz } from "@/lib/kalender/payload";

export interface FristVorlage {
  typ: "FRIST";
  titel: string;
  beschreibung: string;
  /** yyyy-MM-dd */
  datum: string;
  ganztaegig: true;
  /** yyyy-MM-dd */
  fristablauf: string;
  zusatz: FristZusatz;
}

/** Antwort von POST /api/fristen/rechner (JSON-serialisiert), ergänzt um Formulardaten. */
export interface RechnerAntwort {
  richtung: "vorwaerts" | "rueckwaerts";
  ergebnis: {
    startDatum?: string;
    endDatum?: string;
    eingabe?: { fristArt?: string; bundesland?: string };
  };
  vorfristen?: { datum: string; tageVorher: number }[];
  halbfrist?: string | null;
  preset?: { id: string; name: string } | null;
  sonderfall?: { beschreibung: string } | null;
  istNotfrist?: boolean;
  formData?: { sonderfall?: string | null; fristArt?: string; bundesland?: string };
}

const tag = (d: string) => format(new Date(d), "yyyy-MM-dd");

const SONDERFAELLE = ["OEFFENTLICHE_ZUSTELLUNG", "AUSLANDSZUSTELLUNG_EU"] as const;
const FRISTARTEN = ["EREIGNISFRIST", "BEGINNFRIST"] as const;

/** null, wenn sich das Ergebnis nicht als Frist speichern lässt (Rückwärtsberechnung). */
export function fristVorlageAusRechnerErgebnis(r: RechnerAntwort): FristVorlage | null {
  if (r.richtung !== "vorwaerts" || !r.ergebnis?.endDatum) return null;
  const ende = tag(r.ergebnis.endDatum);

  const fristArtRoh = r.ergebnis.eingabe?.fristArt ?? r.formData?.fristArt;
  const fristArt = FRISTARTEN.find((f) => f === fristArtRoh) ?? null;
  const sonderfall = SONDERFAELLE.find((s) => s === r.formData?.sonderfall) ?? null;
  const bundesland = r.ergebnis.eingabe?.bundesland ?? r.formData?.bundesland ?? null;

  const zeilen = ["Berechnet mit dem Fristenrechner."];
  if (r.ergebnis.startDatum) zeilen.push(`Fristbeginn: ${format(new Date(r.ergebnis.startDatum), "dd.MM.yyyy")}`);
  if (bundesland) zeilen.push(`Bundesland: ${bundesland}`);
  if (r.sonderfall?.beschreibung) zeilen.push(`Sonderfall: ${r.sonderfall.beschreibung}`);

  return {
    typ: "FRIST",
    titel: r.preset?.name ?? "Frist",
    beschreibung: zeilen.join("\n"),
    datum: ende,
    ganztaegig: true,
    fristablauf: ende,
    zusatz: {
      istNotfrist: r.istNotfrist ?? false,
      fristArt,
      bundesland,
      sonderfall,
      vorfristen: (r.vorfristen ?? []).map((v) => tag(v.datum)),
      halbfrist: r.halbfrist ? tag(r.halbfrist) : null,
    },
  };
}
