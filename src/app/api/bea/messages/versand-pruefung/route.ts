import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { requirePermission, akteAccessDenied } from "@/lib/rbac";
import { beaVersandPruefungSchema, type BeaVersandPruefungResponse } from "@/lib/bea/versand";
import { pruefeVersand } from "@/lib/bea/regeln";
import { loeseVersandDokumenteAuf } from "@/lib/bea/versand-dokumente";

/**
 * POST /api/bea/messages/versand-pruefung — pre-flight before a beA send.
 * Checks Akte access, the Versand-Gate (FREIGEGEBEN) and the beA rules
 * (limits, character set). Never contacts beA.
 * 400: a document is not approved (errors); 404: document not accessible;
 * 200: { ok, fehler, warnungen, verstoesse } — ok only without fehler and verstoesse.
 */
export async function POST(request: NextRequest) {
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;

  const parsed = beaVersandPruefungSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.akteId) {
    const denied = await akteAccessDenied(result.session, data.akteId);
    if (denied) return denied;
  }

  const user = { id: result.session.user.id, role: result.session.user.role as UserRole };
  const doks = await loeseVersandDokumenteAuf(user, data.anhaenge, data.akteId);
  if (!doks.ok) {
    const response: BeaVersandPruefungResponse = {
      ok: false, fehler: [doks.error], warnungen: [], verstoesse: [], errors: doks.errors,
    };
    return NextResponse.json(response, { status: doks.status });
  }

  // Sizes from the DMS metadata: the pre-flight does not load file contents.
  const pruefung = pruefeVersand({
    ...data,
    anhaenge: doks.dokumente.map((d) => ({ name: d.name, groesse: d.groesse })),
  });
  const response: BeaVersandPruefungResponse = {
    ok: pruefung.fehler.length === 0 && pruefung.verstoesse.length === 0,
    ...pruefung,
    errors: [],
  };
  return NextResponse.json(response);
}
