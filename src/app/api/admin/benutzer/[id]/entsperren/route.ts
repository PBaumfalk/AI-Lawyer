import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { entsperreBenutzer } from "@/lib/benutzer/service";
import { fehlerAntwort } from "@/lib/benutzer/http";

// POST /api/admin/benutzer/[id]/entsperren -- hebt Anmeldesperren auf, ohne
// das Passwort zu ändern oder Sitzungen zu beenden
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  try {
    await entsperreBenutzer(result.session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fehlerAntwort(e);
  }
}
