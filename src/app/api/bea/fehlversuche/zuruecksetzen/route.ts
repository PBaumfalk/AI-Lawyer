import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { setzePostfachFehlversucheZurueck } from "@/lib/bea/fehlversuche";

// POST /api/bea/fehlversuche/zuruecksetzen { postfachSafeId } -- admin only.
// Clears the failure counters and the skipped set of the postbox so the next
// retrieval tries those messages again.
export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;

  const body = (await request.json().catch(() => null)) as { postfachSafeId?: unknown } | null;
  const postfachSafeId = typeof body?.postfachSafeId === "string" ? body.postfachSafeId.trim() : "";
  if (!postfachSafeId || postfachSafeId.length > 200) {
    return NextResponse.json({ error: "Bitte ein beA-Postfach angeben" }, { status: 400 });
  }

  let freigegeben: number;
  try {
    freigegeben = await setzePostfachFehlversucheZurueck(postfachSafeId);
  } catch (e) {
    console.warn(`[bea] Fehlversuche zurücksetzen fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`);
    return NextResponse.json({ error: "Zurücksetzen fehlgeschlagen – bitte später erneut versuchen" }, { status: 503 });
  }

  await logAuditEvent({
    userId: result.session.user.id,
    aktion: "BEA_FEHLVERSUCHE_ZURUECKGESETZT",
    details: { postfachSafeId, freigegeben, ergebnis: "ERFOLG" },
  }).catch(() => {});

  return NextResponse.json({ freigegeben });
}
