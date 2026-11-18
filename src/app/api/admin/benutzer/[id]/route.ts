import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { benutzerAendernSchema } from "@/lib/benutzer/schema";
import { aendereBenutzer } from "@/lib/benutzer/service";
import { fehlerAntwort, validierungsFehler } from "@/lib/benutzer/http";

// PATCH /api/admin/benutzer/[id] -- Name, Rolle, Position, aktiv
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireRole("ADMIN");
  if (result.error) return result.error;
  const { id } = await params;
  const parsed = benutzerAendernSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validierungsFehler(parsed.error);
  try {
    return NextResponse.json(await aendereBenutzer(result.session.user.id, id, parsed.data));
  } catch (e) {
    return fehlerAntwort(e);
  }
}
