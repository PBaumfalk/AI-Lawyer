import { prisma } from "@/lib/db";

/**
 * Versand-Gate: Ensures documents are approved (FREIGEGEBEN) before sending.
 *
 * Rules:
 * - Only documents with status FREIGEGEBEN can be sent (beA, email, Hybridpost)
 * - AI/agents may NEVER set status to FREIGEGEBEN or VERSENDET
 * - Approval requires a human user (freigegebenDurchId must be set)
 *
 * Usage: Call checkDokumenteFreigegeben() with an array of document IDs
 * before any send operation. If it returns errors, block the send.
 */

interface VersandCheckResult {
  ok: boolean;
  errors: { dokumentId: string; name: string; status: string; reason: string }[];
  freigegebeneDokumente: {
    id: string;
    name: string;
    dateipfad: string;
    mimeType: string;
  }[];
}

/**
 * Check if all specified documents are approved for sending.
 * Returns ok=true only if ALL documents have status FREIGEGEBEN.
 */
export async function checkDokumenteFreigegeben(
  dokumentIds: string[]
): Promise<VersandCheckResult> {
  if (dokumentIds.length === 0) {
    return { ok: true, errors: [], freigegebeneDokumente: [] };
  }

  const dokumente = await prisma.dokument.findMany({
    where: { id: { in: dokumentIds } },
    select: {
      id: true,
      name: true,
      status: true,
      dateipfad: true,
      mimeType: true,
      freigegebenDurchId: true,
    },
  });

  const errors: VersandCheckResult["errors"] = [];
  const freigegeben: VersandCheckResult["freigegebeneDokumente"] = [];

  // Check for missing documents
  for (const id of dokumentIds) {
    if (!dokumente.find((d) => d.id === id)) {
      errors.push({
        dokumentId: id,
        name: "(nicht gefunden)",
        status: "UNBEKANNT",
        reason: "Dokument nicht gefunden",
      });
    }
  }

  // Check status of found documents
  for (const dok of dokumente) {
    if (dok.status !== "FREIGEGEBEN") {
      const statusMessages: Record<string, string> = {
        ENTWURF: "Dokument ist ein Entwurf und muss erst freigegeben werden",
        ZUR_PRUEFUNG:
          "Dokument wartet auf Prüfung und muss erst freigegeben werden",
        VERSENDET: "Dokument wurde bereits versendet",
      };

      errors.push({
        dokumentId: dok.id,
        name: dok.name,
        status: dok.status,
        reason:
          statusMessages[dok.status] ?? "Dokument ist nicht freigegeben",
      });
    } else if (!dok.freigegebenDurchId) {
      errors.push({
        dokumentId: dok.id,
        name: dok.name,
        status: dok.status,
        reason:
          "Dokument hat keinen Freigabe-Verantwortlichen (systemische Inkonsistenz)",
      });
    } else {
      freigegeben.push({
        id: dok.id,
        name: dok.name,
        dateipfad: dok.dateipfad,
        mimeType: dok.mimeType,
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    freigegebeneDokumente: freigegeben,
  };
}

/**
 * Mark documents as sent (VERSENDET) after successful transmission.
 * Should only be called after actual send was confirmed.
 */
export async function markDokumenteVersendet(
  dokumentIds: string[]
): Promise<void> {
  if (dokumentIds.length === 0) return;

  await prisma.dokument.updateMany({
    where: {
      id: { in: dokumentIds },
      status: "FREIGEGEBEN", // Only update if still FREIGEGEBEN
    },
    data: { status: "VERSENDET" },
  });
}
