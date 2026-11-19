// Größengrenze für JSON-Anfragen an /api (eigener Server, src/server.ts).
//
// Zod 3 legt beim Prüfen großer Arrays für jedes fehlerhafte Element ein
// Issue-Objekt an (GHSA-mrhx-c7xc-m3w5, behoben erst in zod 4.6.6, das an die
// AI-SDK-Migration gekoppelt ist). Gemessen: rund 150–180 MB Heap je MB
// Anfrage. Ohne Grenze kann ein angemeldetes Konto den Prozess mit einer
// einzigen Anfrage zum Absturz bringen. Datei-Uploads (multipart) sind nicht
// betroffen und behalten ihre eigenen Grenzen.

export const STANDARD_JSON_MAX_BYTES = 2 * 1024 * 1024;

export function jsonMaxBytes(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.API_JSON_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : STANDARD_JSON_MAX_BYTES;
}

export interface Ablehnung {
  status: 411 | 413;
  meldung: string;
}

/** Prüft Methode, Pfad und Header; null = Anfrage darf weiter. */
export function pruefeAnfrageGroesse(
  method: string | undefined,
  url: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  maxBytes: number
): Ablehnung | null {
  if (!method || ["GET", "HEAD", "OPTIONS", "DELETE"].includes(method.toUpperCase())) return null;
  if (!url || !url.startsWith("/api/")) return null;
  const typ = String(headers["content-type"] ?? "").toLowerCase();
  if (!typ.includes("json")) return null;
  const laenge = headers["content-length"];
  if (laenge === undefined) {
    // Ohne Längenangabe (chunked) ließe sich die Grenze umgehen. Browser und
    // übliche HTTP-Clients senden bei JSON immer Content-Length.
    if (headers["transfer-encoding"]) {
      return { status: 411, meldung: "JSON-Anfragen brauchen eine Content-Length-Angabe." };
    }
    return null;
  }
  const n = Number(Array.isArray(laenge) ? laenge[0] : laenge);
  if (!Number.isFinite(n) || n > maxBytes) {
    return {
      status: 413,
      meldung: `Anfrage zu groß (höchstens ${Math.round(maxBytes / 1024)} KB JSON).`,
    };
  }
  return null;
}
