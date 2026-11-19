/**
 * Freigabe of a Vorlage: POST /api/vorlagen/[id]/freigabe approves,
 * DELETE revokes. The settings tab sent POST {freigeben:false} to revoke,
 * which the route ignores (body unused) → 400 "bereits freigegeben".
 * Client-safe.
 */
export function vorlageFreigabeRequest(
  vorlageId: string,
  freigeben: boolean
): { url: string; init: { method: "POST" | "DELETE" } } {
  return {
    url: `/api/vorlagen/${encodeURIComponent(vorlageId)}/freigabe`,
    init: { method: freigeben ? "POST" : "DELETE" },
  };
}
