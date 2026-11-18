/**
 * Gruppierung für die Tagesübersicht im Dashboard.
 *
 * - Fristen und Wiedervorlagen: offen und fällig bis einschließlich heute
 *   (überfällige zuerst, dann nach Datum).
 * - Termine und externe Termine: nur heute – vergangene Termine sind keine
 *   offenen Aufgaben.
 * „Heute" ist der Kalendertag in der Kanzlei-Zeitzone.
 */
import { kanzleiTag } from "./erledigung";
import type { KalenderListenEintrag } from "@/lib/kalender/eintrag";

export interface Tagesuebersicht<T> {
  fristen: T[];
  wiedervorlagen: T[];
  termine: T[];
  externeTermine: T[];
}

export function gruppiereTagesuebersicht<T extends KalenderListenEintrag>(
  items: T[],
  now: Date = new Date(),
): Tagesuebersicht<T> {
  const heute = kanzleiTag(now);
  const offen = Array.from(new Map(items.map((i) => [i.id, i])).values()).filter((i) => !i.erledigt);
  const nachDatum = (a: T, b: T) => new Date(a.datum).getTime() - new Date(b.datum).getTime();
  const bisHeute = (i: T) => kanzleiTag(i.datum) <= heute;
  const nurHeute = (i: T) => kanzleiTag(i.datum) === heute;

  return {
    fristen: offen.filter((i) => i.typ === "FRIST" && bisHeute(i)).sort(nachDatum),
    wiedervorlagen: offen.filter((i) => i.typ === "WIEDERVORLAGE" && bisHeute(i)).sort(nachDatum),
    termine: offen.filter((i) => i.typ === "TERMIN" && nurHeute(i)).sort(nachDatum),
    externeTermine: offen.filter((i) => i.typ === "EXTERN" && nurHeute(i)).sort(nachDatum),
  };
}
