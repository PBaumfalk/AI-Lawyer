import { describe, it, expect, beforeAll } from "vitest";
import { ermittleClientIp, clientIp, trustProxyHops, CLIENT_IP_HEADER } from "@/lib/client-ip";
import { geraetTokenErzeugen, geraetVertraut, geraetCookieAus, GERAET_COOKIE } from "@/lib/login-geraet";

describe("ermittleClientIp", () => {
  it("ohne Proxy zählt nur die TCP-Gegenstelle, X-Forwarded-For wird ignoriert", () => {
    expect(ermittleClientIp("203.0.113.9", "1.2.3.4", 0)).toBe("203.0.113.9");
  });

  it("entfernt das IPv4-in-IPv6-Präfix", () => {
    expect(ermittleClientIp("::ffff:10.0.0.7", null, 0)).toBe("10.0.0.7");
  });

  it("mit einem Proxy gilt der vom Proxy angehängte Eintrag, nicht der vom Client behauptete", () => {
    // Client schickt selbst "1.2.3.4", der Proxy hängt die echte Adresse an.
    expect(ermittleClientIp("172.18.0.2", "1.2.3.4, 198.51.100.20", 1)).toBe("198.51.100.20");
  });

  it("zwei Proxys: der Eintrag zwei Stellen vor der Gegenstelle", () => {
    expect(ermittleClientIp("172.18.0.2", "6.6.6.6, 198.51.100.20, 10.0.0.5", 2)).toBe("198.51.100.20");
  });

  it("mehrere X-Forwarded-For-Header werden zusammengefügt", () => {
    expect(ermittleClientIp("172.18.0.2", ["1.2.3.4", "198.51.100.20"], 1)).toBe("198.51.100.20");
  });

  it("TRUST_PROXY_HOPS: Standard 0, ungültige Werte 0", () => {
    expect(trustProxyHops({})).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "1" })).toBe(1);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "-1" })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "abc" })).toBe(0);
  });

  it("clientIp liest nur den internen Header, nicht X-Forwarded-For", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } }))).toBeNull();
    expect(clientIp(new Request("http://x", { headers: { [CLIENT_IP_HEADER]: "198.51.100.20" } }))).toBe(
      "198.51.100.20"
    );
  });
});

describe("Geräte-Cookie", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "unit-test-secret-0123456789abcdef";
  });

  it("gilt nur für das Konto, für das es ausgestellt wurde", () => {
    const t = geraetTokenErzeugen("Anna@Kanzlei.de")!;
    expect(geraetVertraut(t, "anna@kanzlei.de")).toBe(true);
    expect(geraetVertraut(t, "bert@kanzlei.de")).toBe(false);
  });

  it("verwirft veränderte, fremd signierte und abgelaufene Cookies", () => {
    const t = geraetTokenErzeugen("anna@kanzlei.de")!;
    const teile = t.split(".");
    expect(geraetVertraut([teile[0], "andere", teile[2], teile[3]].join("."), "anna@kanzlei.de")).toBe(false);
    expect(geraetVertraut(t.slice(0, -2) + "xx", "anna@kanzlei.de")).toBe(false);
    expect(geraetVertraut("a.b.c", "anna@kanzlei.de")).toBe(false);
    const alt = geraetTokenErzeugen("anna@kanzlei.de", Date.now() - 200 * 24 * 3600 * 1000)!;
    expect(geraetVertraut(alt, "anna@kanzlei.de")).toBe(false);
    process.env.NEXTAUTH_SECRET = "anderes-geheimnis-0123456789abcdef";
    expect(geraetVertraut(t, "anna@kanzlei.de")).toBe(false);
    process.env.NEXTAUTH_SECRET = "unit-test-secret-0123456789abcdef";
  });

  it("liest das Cookie aus dem Cookie-Header", () => {
    const r = new Request("http://x", { headers: { cookie: `a=1; ${GERAET_COOKIE}=wert.x.y.z; b=2` } });
    expect(geraetCookieAus(r)).toBe("wert.x.y.z");
    expect(geraetCookieAus(new Request("http://x"))).toBeNull();
  });
});
