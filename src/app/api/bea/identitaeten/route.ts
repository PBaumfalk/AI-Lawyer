import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getBeaProvider } from "@/lib/bea/provider";
import { mitBeaSitzung, BeaNichtEingerichtetError } from "@/lib/bea/sitzung";
import { createLogger } from "@/lib/logger";

const log = createLogger("bea-identitaeten");

/**
 * GET /api/bea/identitaeten?name=&plz=&ort= — searches the beA directory
 * (Gesamtverzeichnis) through the caller's beA session. Read-only, so the
 * call may be repeated once after a session error (wiederholen: true).
 */
export async function GET(request: NextRequest) {
  const result = await requirePermission("canReadBeA");
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const feld = (k: string) => searchParams.get(k)?.trim() || undefined;
  const q = { name: feld("name"), plz: feld("plz"), ort: feld("ort") };
  if (!q.name && !q.plz && !q.ort) {
    return NextResponse.json({ error: "Bitte Name, PLZ oder Ort angeben" }, { status: 400 });
  }

  if (!getBeaProvider()) {
    return NextResponse.json({ error: "beA ist nicht eingerichtet" }, { status: 503 });
  }

  try {
    const identitaeten = await mitBeaSitzung(
      result.session.user.id,
      (s, p) => p.sucheIdentitaet(s, q),
      { wiederholen: true },
    );
    return NextResponse.json({ identitaeten });
  } catch (e) {
    if (e instanceof BeaNichtEingerichtetError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    log.warn({ err: e instanceof Error ? e.message : "Unbekannter Fehler" }, "beA-Verzeichnissuche fehlgeschlagen");
    return NextResponse.json({ error: "beA ist derzeit nicht erreichbar" }, { status: 502 });
  }
}
