// Ermittelt die Client-Adresse für Anmeldeschutz und Audit-Log.
//
// X-Forwarded-For kann jeder Client selbst setzen. Vertraut wird ihm nur so
// weit, wie tatsächlich Proxys vor der Anwendung stehen: TRUST_PROXY_HOPS
// (Standard 0 = kein Proxy, die TCP-Gegenstelle ist der Client). Bei einem
// Reverse-Proxy (Caddy, nginx, Traefik) TRUST_PROXY_HOPS=1 setzen; der Proxy
// muss X-Forwarded-For anhängen, nicht durchreichen.
//
// Der eigene Server (src/server.ts) berechnet die Adresse einmal aus der
// Socket-Verbindung und gibt sie Next.js als CLIENT_IP_HEADER mit. Ein vom
// Client mitgeschickter Header dieses Namens wird vorher entfernt.

export const CLIENT_IP_HEADER = "x-ailawyer-client-ip";

export function trustProxyHops(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TRUST_PROXY_HOPS ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
}

function normalisieren(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const s = ip.trim();
  if (!s) return null;
  return s.startsWith("::ffff:") ? s.slice(7) : s;
}

/**
 * @param remoteAddress TCP-Gegenstelle (req.socket.remoteAddress)
 * @param forwardedFor  Wert von X-Forwarded-For (ggf. mehrere Header verbunden)
 * @param hops          Anzahl vertrauenswürdiger Proxys direkt vor der Anwendung
 */
export function ermittleClientIp(
  remoteAddress: string | undefined | null,
  forwardedFor: string | string[] | undefined | null,
  hops: number
): string | null {
  const direkt = normalisieren(remoteAddress);
  if (hops <= 0) return direkt;
  const liste = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Kette: [vom Client behauptet ..., vom ersten Proxy eingetragen] + Gegenstelle.
  // Der Eintrag `hops` Positionen vor der Gegenstelle stammt vom äußersten
  // vertrauenswürdigen Proxy und ist damit die echte Client-Adresse.
  const kette = [...liste, direkt ?? ""];
  const idx = kette.length - 1 - hops;
  if (idx < 0) return normalisieren(kette[0]);
  return normalisieren(kette[idx]);
}

/** Client-Adresse in Route-Handlern und NextAuth (nur vom eigenen Server gesetzt). */
export function clientIp(request?: Request | null): string | null {
  const h = request?.headers;
  if (!h || typeof h.get !== "function") return null;
  return normalisieren(h.get(CLIENT_IP_HEADER));
}
