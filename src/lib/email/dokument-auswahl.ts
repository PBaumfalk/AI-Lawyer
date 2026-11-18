/**
 * Document picker contract for E-Mail- and beA-Compose.
 *
 * Source: GET /api/akten/[id]/dokumente → { dokumente: Dokument[], ordnerList }.
 * (There is no GET /api/dokumente list route; documents are always picked
 * from a selected Akte, which also enforces the Akte access check.)
 */

export interface AuswahlDokument {
  id: string;
  name: string;
  mimeType: string;
  groesse: number;
  status: string;
}

export function aktenDokumenteUrl(akteId: string, q?: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const qs = params.toString();
  return `/api/akten/${encodeURIComponent(akteId)}/dokumente${qs ? `?${qs}` : ""}`;
}

/** Parse the JSON body of GET /api/akten/[id]/dokumente. Throws on an unexpected shape. */
export function parseAktenDokumente(json: unknown): AuswahlDokument[] {
  const list = (json as { dokumente?: unknown } | null)?.dokumente;
  if (!Array.isArray(list)) {
    throw new Error("Unerwartete Antwort der Dokumentenliste");
  }
  return list.map((d: any) => ({
    id: String(d.id),
    name: String(d.name ?? "Dokument"),
    mimeType: String(d.mimeType ?? "application/octet-stream"),
    groesse: typeof d.groesse === "number" ? d.groesse : 0,
    status: String(d.status ?? "ENTWURF"),
  }));
}

// ─── Akte search (GET /api/akten?q=&take= → { akten, total }) ───────────────

export interface AuswahlAkte {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

export function aktenSucheUrl(q: string, take = 10): string {
  const params = new URLSearchParams({ q, take: String(take) });
  return `/api/akten?${params.toString()}`;
}

export function parseAktenSuche(json: unknown): AuswahlAkte[] {
  const list = (json as { akten?: unknown } | null)?.akten;
  if (!Array.isArray(list)) throw new Error("Unerwartete Antwort der Aktensuche");
  return list.map((a: any) => ({
    id: String(a.id),
    aktenzeichen: String(a.aktenzeichen ?? ""),
    kurzrubrum: String(a.kurzrubrum ?? ""),
  }));
}

export async function ladeAktenDokumente(akteId: string, q?: string): Promise<AuswahlDokument[]> {
  const res = await fetch(aktenDokumenteUrl(akteId, q));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Dokumente konnten nicht geladen werden");
  }
  return parseAktenDokumente(await res.json());
}
