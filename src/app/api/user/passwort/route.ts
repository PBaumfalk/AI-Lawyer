import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { eigenesPasswortSchema } from "@/lib/benutzer/schema";
import { aendereEigenesPasswort } from "@/lib/benutzer/service";
import { fehlerAntwort, validierungsFehler } from "@/lib/benutzer/http";

// POST /api/user/passwort -- eigenes Passwort ändern; beendet alle Sitzungen
// (auch die aktuelle), danach neu anmelden
export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  if (result.session.user.role === "MANDANT") {
    return NextResponse.json({ error: "Bitte das Mandantenportal verwenden" }, { status: 403 });
  }
  const parsed = eigenesPasswortSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validierungsFehler(parsed.error);
  try {
    await aendereEigenesPasswort(result.session.user.id, parsed.data.aktuell, parsed.data.neu);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fehlerAntwort(e);
  }
}
