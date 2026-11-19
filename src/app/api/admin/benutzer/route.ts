import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { benutzerAnlegenSchema } from "@/lib/benutzer/schema";
import { legeBenutzerAn, listeBenutzer } from "@/lib/benutzer/service";
import { fehlerAntwort, validierungsFehler } from "@/lib/benutzer/http";

// GET /api/admin/benutzer -- alle Kanzleikonten inkl. deaktivierter
export async function GET() {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  return NextResponse.json(await listeBenutzer());
}

// POST /api/admin/benutzer -- Konto anlegen; Startpasswort nur in dieser Antwort
export async function POST(request: NextRequest) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const parsed = benutzerAnlegenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validierungsFehler(parsed.error);
  try {
    return NextResponse.json(await legeBenutzerAn(result.session.user.id, parsed.data), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return fehlerAntwort(e);
  }
}
