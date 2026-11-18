/**
 * Antwortvertrag von GET /api/kalender.
 *
 * Die Liste enthält interne Einträge (TERMIN/FRIST/WIEDERVORLAGE) und externe
 * CalDAV-Termine (typ "EXTERN"). Externe Termine haben keinen Verantwortlichen,
 * keine Akte und keine eigene KalenderEintrag-ID (die id ist die des
 * Sync-Mappings) – sie können weder erledigt, bearbeitet noch gelöscht werden.
 */

export type KalenderInternTyp = "TERMIN" | "FRIST" | "WIEDERVORLAGE";
export type KalenderListenTyp = KalenderInternTyp | "EXTERN";

export interface KalenderListenEintrag {
  id: string;
  typ: KalenderListenTyp;
  titel: string;
  beschreibung: string | null;
  datum: string;
  datumBis: string | null;
  ganztaegig: boolean;
  erledigt: boolean;
  erledigtAm?: string | null;
  akteId: string | null;
  verantwortlichId: string;
  fristablauf?: string | null;
  vorfrist?: string | null;
  prioritaet?: string;
  istNotfrist?: boolean;
  akte: { id?: string; aktenzeichen: string; kurzrubrum: string } | null;
  /** null bei externen CalDAV-Terminen */
  verantwortlich: { id?: string; name: string } | null;
  kontoName?: string | null;
  kontoProvider?: string | null;
}

export interface CalDavPullMapping {
  id: string;
  externalData: unknown;
  konto?: { name: string | null; provider: string | null } | null;
}

/** Externer CalDAV-Termin als Listeneintrag; null bei unbrauchbaren Daten. */
export function externerKalenderEintrag(
  mapping: CalDavPullMapping,
  userId: string,
): KalenderListenEintrag | null {
  const ext = mapping.externalData as
    | { summary?: string; description?: string; dtstart?: string; dtend?: string; allDay?: boolean }
    | null;
  if (!ext?.summary || !ext?.dtstart) return null;
  const dtstart = new Date(ext.dtstart);
  if (isNaN(dtstart.getTime())) return null;
  const dtend = ext.dtend ? new Date(ext.dtend) : null;
  return {
    id: mapping.id,
    typ: "EXTERN",
    titel: ext.summary,
    beschreibung: ext.description ?? null,
    datum: dtstart.toISOString(),
    datumBis: dtend && !isNaN(dtend.getTime()) ? dtend.toISOString() : null,
    ganztaegig: ext.allDay ?? false,
    erledigt: false,
    prioritaet: "NORMAL",
    istNotfrist: false,
    akteId: null,
    verantwortlichId: userId,
    akte: null,
    verantwortlich: null,
    kontoName: mapping.konto?.name ?? null,
    kontoProvider: mapping.konto?.provider ?? null,
  };
}

export interface KalenderListenFilter {
  akteId?: string | null;
  typ?: string | null;
  erledigt?: string | null;
  verantwortlichId?: string | null;
  prioritaet?: string | null;
  istNotfrist?: string | null;
}

/**
 * Externe Termine gehören nur in die persönliche Gesamtliste: nicht in eine
 * Akte, nicht in Typ-/Prioritäts-/Notfrist-Filter, nicht unter „erledigt"
 * und nicht in die Liste eines anderen Verantwortlichen.
 */
export function externeTermineEinbeziehen(f: KalenderListenFilter, userId: string): boolean {
  if (f.akteId) return false;
  if (f.typ) return false;
  if (f.erledigt === "true") return false;
  if (f.prioritaet) return false;
  if (f.istNotfrist === "true") return false;
  if (f.verantwortlichId && f.verantwortlichId !== userId) return false;
  return true;
}

export function istExtern(e: Pick<KalenderListenEintrag, "typ">): boolean {
  return e.typ === "EXTERN";
}

/** Clientseitige Volltextsuche der Kalenderliste (Titel, Akte, Verantwortlicher, Konto). */
export function filterKalenderEintraege<T extends KalenderListenEintrag>(eintraege: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return eintraege;
  return eintraege.filter((e) =>
    [e.titel, e.akte?.aktenzeichen, e.akte?.kurzrubrum, e.verantwortlich?.name, e.kontoName]
      .some((s) => s?.toLowerCase().includes(q)),
  );
}

/** Anzeigename der zuständigen Person bzw. des externen Kalenders. */
export function verantwortlichAnzeige(e: KalenderListenEintrag): string {
  return e.verantwortlich?.name ?? e.kontoName ?? "Externer Kalender";
}
