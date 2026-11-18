/**
 * Shared contract for listing/searching Kontakte.
 *
 * Used by GET /api/kontakte, the Kontakte page, the export route and every
 * client component that searches contacts, so the query parameter names, the
 * search fields and the response shape cannot drift apart again (DSGVO page
 * sent `search=`, the Beteiligte dialog stored `{kontakte,total}` as a list,
 * list/export read the legacy address columns the form no longer fills).
 *
 * Client-safe: only type imports from @prisma/client.
 */
import type { Prisma, KontaktTyp } from "@prisma/client";

// ─── Request ────────────────────────────────────────────────────────────────

export interface KontakteListQuery {
  /** Free-text search (name, firm, e-mail, phone, PLZ/Ort of any address …). */
  q?: string;
  typ?: KontaktTyp;
  tag?: string;
  take?: number;
  skip?: number;
}

export const KONTAKTE_MAX_TAKE = 100;

/** URL for GET /api/kontakte. */
export function kontakteListUrl(query: KontakteListQuery = {}): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.typ) p.set("typ", query.typ);
  if (query.tag) p.set("tag", query.tag);
  if (query.take !== undefined) p.set("take", String(query.take));
  if (query.skip !== undefined) p.set("skip", String(query.skip));
  const s = p.toString();
  return s ? `/api/kontakte?${s}` : "/api/kontakte";
}

function intParam(value: string | null, fallback: number, max: number): number {
  const n = value === null ? NaN : parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/** Inverse of kontakteListUrl, used by the route. */
export function parseKontakteListQuery(searchParams: URLSearchParams): Required<Pick<KontakteListQuery, "take" | "skip">> & KontakteListQuery {
  const typ = searchParams.get("typ");
  return {
    q: searchParams.get("q")?.trim() || undefined,
    typ: typ === "NATUERLICH" || typ === "JURISTISCH" ? typ : undefined,
    tag: searchParams.get("tag") || undefined,
    take: intParam(searchParams.get("take"), 50, KONTAKTE_MAX_TAKE),
    skip: intParam(searchParams.get("skip"), 0, Number.MAX_SAFE_INTEGER),
  };
}

/** Prisma WHERE for the list/search. Addresses are searched in both the
 *  Adresse relation (what the form writes) and the legacy columns (imports). */
export function kontakteWhere(query: Pick<KontakteListQuery, "q" | "typ" | "tag">): Prisma.KontaktWhereInput {
  const where: Prisma.KontaktWhereInput = {};
  if (query.typ) where.typ = query.typ;
  if (query.tag) where.tags = { has: query.tag };
  const q = query.q;
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { nachname: c },
      { vorname: c },
      { firma: c },
      { kurzname: c },
      { email: c },
      { ort: c },
      { plz: c },
      { telefon: c },
      { mandantennummer: c },
      { ustIdNr: c },
      { adressen: { some: { OR: [{ ort: c }, { plz: c }, { strasse: c }] } } },
    ];
  }
  return where;
}

/** Include clause that loads addresses in display order (main address first). */
export const KONTAKT_ADRESSEN_INCLUDE = {
  adressen: { orderBy: [{ istHaupt: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.KontaktInclude;

// ─── Address ────────────────────────────────────────────────────────────────

export interface KontaktAnschrift {
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
}

interface AdresseLike {
  typ?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  istHaupt?: boolean | null;
}

/**
 * The address to show/export for a contact: the main address from the Adresse
 * relation (istHaupt, else HAUPTANSCHRIFT, else the first one), falling back to
 * the legacy columns that CSV/vCard imports still fill.
 */
export function hauptAnschrift(k: {
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  adressen?: AdresseLike[] | null;
}): KontaktAnschrift | null {
  const list = (k.adressen ?? []).filter((a) => a.strasse || a.plz || a.ort);
  const a =
    list.find((x) => x.istHaupt) ?? list.find((x) => x.typ === "HAUPTANSCHRIFT") ?? list[0];
  if (a) {
    return {
      strasse: a.strasse ?? null,
      hausnummer: a.hausnummer ?? null,
      plz: a.plz ?? null,
      ort: a.ort ?? null,
      land: a.land ?? null,
    };
  }
  if (k.strasse || k.plz || k.ort) {
    return { strasse: k.strasse ?? null, hausnummer: null, plz: k.plz ?? null, ort: k.ort ?? null, land: k.land ?? null };
  }
  return null;
}

/** "Musterstr. 1" */
export function anschriftStrasse(a: KontaktAnschrift | null): string {
  return a ? [a.strasse, a.hausnummer].filter(Boolean).join(" ") : "";
}

/** "12345 Berlin" */
export function anschriftOrt(a: KontaktAnschrift | null): string {
  return a ? [a.plz, a.ort].filter(Boolean).join(" ") : "";
}

// ─── Response ───────────────────────────────────────────────────────────────

/** One row of GET /api/kontakte. */
export interface KontakteListItem {
  id: string;
  typ: KontaktTyp;
  vorname: string | null;
  nachname: string | null;
  firma: string | null;
  email: string | null;
  telefon: string | null;
  beaSafeId: string | null;
  mandantennummer: string | null;
  tags: string[];
  /** Main address resolved by hauptAnschrift(). */
  anschrift: KontaktAnschrift | null;
  _count: { beteiligte: number };
}

export interface KontakteListResponse {
  kontakte: KontakteListItem[];
  total: number;
}

/** Display name: person "Vorname Nachname", firm "Firma". */
export function kontaktAnzeigename(k: Pick<KontakteListItem, "typ" | "vorname" | "nachname" | "firma">): string {
  if (k.typ === "NATUERLICH") return [k.vorname, k.nachname].filter(Boolean).join(" ");
  return k.firma ?? "";
}
