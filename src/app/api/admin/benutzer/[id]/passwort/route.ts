import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { passwortZuruecksetzenSchema } from "@/lib/benutzer/schema";
import { setzePasswortZurueck } from "@/lib/benutzer/service";
import { fehlerAntwort, validierungsFehler } from "@/lib/benutzer/http";

// POST /api/admin/benutzer/[id]/passwort -- neues Startpasswort, beendet alle
// Sitzungen des Kontos, hebt eine Anmeldesperre auf; optional 2FA zurücksetzen
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  const parsed = passwortZuruecksetzenSchema.safeParse((await request.json().catch(() => null)) ?? {});
  if (!parsed.success) return validierungsFehler(parsed.error);
  try {
    return NextResponse.json(await setzePasswortZurueck(result.session.user.id, id, parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return fehlerAntwort(e);
  }
}
