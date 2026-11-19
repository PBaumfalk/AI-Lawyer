// Grenzen für öffentliche Kontowege (Passwort vergessen, Reset, Aktivierung).
// Gibt eine fertige Fehlerantwort zurück oder null, wenn die Anfrage weiterlaufen darf.
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { ANMELDESCHUTZ_FEHLT, fensterUeberschritten, LimiterNichtVerfuegbar } from "@/lib/login-throttle";

export async function quelleBegrenzt(
  req: Request,
  bereich: string,
  grenze: number,
  fensterSekunden: number
): Promise<NextResponse | null> {
  try {
    if (await fensterUeberschritten(bereich, clientIp(req) ?? "unbekannt", grenze, fensterSekunden)) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        { status: 429, headers: { "Retry-After": String(fensterSekunden) } }
      );
    }
    return null;
  } catch (e) {
    if (e instanceof LimiterNichtVerfuegbar) {
      return NextResponse.json({ error: ANMELDESCHUTZ_FEHLT }, { status: 503, headers: { "Retry-After": "60" } });
    }
    throw e;
  }
}
