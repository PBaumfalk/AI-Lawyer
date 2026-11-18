/**
 * GET /api/dokumente/tags response, shared by the route, the search page's
 * tag filter and the tag manager (the search page read `kategorien`).
 * Client-safe.
 */
export const DOKUMENT_TAGS_URL = "/api/dokumente/tags";

export interface DokumentTagKategorieDto {
  id: string;
  name: string;
  farbe: string;
  sortierung: number;
  system: boolean;
}

export interface DokumentTagsResponse {
  tags: DokumentTagKategorieDto[];
}
