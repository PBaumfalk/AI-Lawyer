/**
 * Server-side resolution of beA attachments: Akte access and Versand-Gate
 * (FREIGEGEBEN with a human approver) for the referenced DMS documents.
 */
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { checkDokumenteFreigegeben } from "@/lib/versand-gate";
import type { BeaDokumentFehler } from "./versand";

export interface VersandDokument {
  id: string;
  name: string;
  dateipfad: string;
  mimeType: string;
  groesse: number;
  art: "SCHRIFTSATZ" | "ATTACHMENT";
}

export type VersandDokumentAufloesung =
  | { ok: true; dokumente: VersandDokument[] }
  | { ok: false; status: number; error: string; errors: BeaDokumentFehler[] };

/**
 * Resolves attachments in request order. Rejects unless an Akte is given,
 * every document belongs to that Akte, is accessible to the user and approved.
 */
export async function loeseVersandDokumenteAuf(
  user: { id: string; role: UserRole },
  anhaenge: { dokumentId: string; art: "SCHRIFTSATZ" | "ATTACHMENT" }[],
  akteId: string | null | undefined,
): Promise<VersandDokumentAufloesung> {
  if (anhaenge.length === 0) return { ok: true, dokumente: [] };
  if (!akteId) {
    return { ok: false, status: 400, error: "Für Anhänge muss eine Akte angegeben werden", errors: [] };
  }
  const ids = anhaenge.map((a) => a.dokumentId);

  const zugaenglich = await prisma.dokument.findMany({
    where: { id: { in: ids }, akte: buildAkteAccessFilter(user.id, user.role) },
    select: { id: true, akteId: true, name: true, dateipfad: true, mimeType: true, groesse: true },
  });
  const fehlend = ids.filter((id) => !zugaenglich.some((d) => d.id === id));
  if (fehlend.length > 0) {
    return {
      ok: false,
      status: 404,
      error: "Dokument nicht gefunden",
      errors: fehlend.map((dokumentId) => ({
        dokumentId, name: "", status: "UNBEKANNT", reason: "Dokument nicht gefunden",
      })),
    };
  }

  const fremd = zugaenglich.filter((d) => d.akteId !== akteId);
  if (fremd.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Dokument gehört nicht zur Akte",
      errors: fremd.map((d) => ({
        dokumentId: d.id, name: d.name, status: "FREMDE_AKTE", reason: "Dokument gehört nicht zur Akte",
      })),
    };
  }

  const gate = await checkDokumenteFreigegeben(ids);
  if (!gate.ok) {
    return {
      ok: false,
      status: 400,
      error: "Nicht freigegebene Dokumente können nicht versendet werden",
      errors: gate.errors,
    };
  }

  return {
    ok: true,
    dokumente: anhaenge.map((a) => {
      const { akteId: _akteId, ...d } = zugaenglich.find((z) => z.id === a.dokumentId)!;
      return { ...d, art: a.art };
    }),
  };
}
