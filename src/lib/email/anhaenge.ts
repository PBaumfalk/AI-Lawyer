/**
 * Server-side resolution of email attachment references (see send-contract.ts)
 * into the data for EmailAnhang rows.
 *
 * Every reference is checked before anything is queued:
 *  - DMS documents: the user must have access to the document's Akte and the
 *    document must pass the Versand-Gate (FREIGEGEBEN with a human approver).
 *  - Uploads: the storage key must lie under the user's own upload prefix,
 *    so nobody can attach arbitrary objects from the bucket by key.
 *  - Forwarded attachments: the user must have access to the source mailbox.
 */
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { checkDokumenteFreigegeben } from "@/lib/versand-gate";
import { emailUploadPrefix, type EmailAnhangRef } from "./send-contract";

export interface AufgeloesterAnhang {
  dateiname: string;
  mimeType: string;
  groesse: number;
  speicherPfad: string;
}

export type AnhangAufloesung =
  | { ok: true; anhaenge: AufgeloesterAnhang[]; dmsDokumentIds: string[] }
  | { ok: false; status: number; error: string; details?: unknown };

export async function resolveEmailAnhaenge(
  user: { id: string; role: UserRole },
  refs: EmailAnhangRef[]
): Promise<AnhangAufloesung> {
  const anhaenge: AufgeloesterAnhang[] = [];

  // ── DMS documents ────────────────────────────────────────────────────────
  const dmsIds = Array.from(
    new Set(refs.filter((r) => r.quelle === "dms").map((r) => (r as { dokumentId: string }).dokumentId))
  );
  if (dmsIds.length > 0) {
    const zugaenglich = await prisma.dokument.findMany({
      where: { id: { in: dmsIds }, akte: buildAkteAccessFilter(user.id, user.role) },
      select: { id: true, name: true, dateipfad: true, mimeType: true, groesse: true },
    });
    if (zugaenglich.length !== dmsIds.length) {
      return { ok: false, status: 404, error: "Dokument nicht gefunden" };
    }
    const check = await checkDokumenteFreigegeben(dmsIds);
    if (!check.ok) {
      return {
        ok: false,
        status: 400,
        error: "Nicht freigegebene Dokumente können nicht versendet werden",
        details: check.errors,
      };
    }
    for (const id of dmsIds) {
      const d = zugaenglich.find((z) => z.id === id)!;
      anhaenge.push({ dateiname: d.name, mimeType: d.mimeType, groesse: d.groesse, speicherPfad: d.dateipfad });
    }
  }

  // ── Uploads ──────────────────────────────────────────────────────────────
  const prefix = emailUploadPrefix(user.id);
  for (const r of refs) {
    if (r.quelle !== "upload") continue;
    if (!r.speicherPfad.startsWith(prefix) || r.speicherPfad.includes("..")) {
      return { ok: false, status: 403, error: "Ungültiger Upload-Anhang" };
    }
    anhaenge.push({ dateiname: r.dateiname, mimeType: r.mimeType, groesse: r.groesse, speicherPfad: r.speicherPfad });
  }

  // ── Forwarded attachments ────────────────────────────────────────────────
  const emailAnhangIds = Array.from(
    new Set(refs.filter((r) => r.quelle === "email").map((r) => (r as { anhangId: string }).anhangId))
  );
  if (emailAnhangIds.length > 0) {
    const kontoFilter =
      user.role === "ADMIN"
        ? {}
        : { emailNachricht: { emailKonto: { zuweisungen: { some: { userId: user.id } } } } };
    const quellen = await prisma.emailAnhang.findMany({
      where: { id: { in: emailAnhangIds }, ...kontoFilter },
      select: { id: true, dateiname: true, mimeType: true, groesse: true, speicherPfad: true },
    });
    if (quellen.length !== emailAnhangIds.length) {
      return { ok: false, status: 404, error: "Anhang nicht gefunden" };
    }
    for (const id of emailAnhangIds) {
      const a = quellen.find((q) => q.id === id)!;
      anhaenge.push({ dateiname: a.dateiname, mimeType: a.mimeType, groesse: a.groesse, speicherPfad: a.speicherPfad });
    }
  }

  return { ok: true, anhaenge, dmsDokumentIds: dmsIds };
}
