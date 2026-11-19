import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { config as middlewareConfig } from "@/middleware";

const authorized = authConfig.callbacks.authorized as (args: {
  auth: any;
  request: NextRequest;
}) => boolean | Response;

const reqFor = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
const as = (role: string, extra: Record<string, unknown> = {}) => ({
  user: { id: "u1", role, totpEnabled: false, ...extra },
});

function verdict(path: string, auth: any) {
  const r = authorized({ auth, request: reqFor(path) });
  if (r === true) return "erlaubt";
  if (r === false) return "anmelden";
  const res = r as Response;
  if (res.status === 403) return "verboten";
  if (res.status === 401) return "401";
  return `weiter:${new URL(res.headers.get("location") ?? "").pathname}`;
}

// The matcher string is a path-to-regexp pattern made of a single regex group.
const matcher = new RegExp(`^${middlewareConfig.matcher[0]}$`);

afterEach(() => {
  delete process.env.TOTP_REQUIRED_ROLES;
});

describe("Middleware: Anmeldung", () => {
  it("lässt Anonyme nicht in die Kanzleioberfläche", () => {
    expect(verdict("/akten", null)).toBe("anmelden");
    expect(verdict("/dashboard", null)).toBe("anmelden");
  });

  it("antwortet Anonymen auf API-Pfaden mit 401 statt Login-Umleitung", () => {
    expect(verdict("/api/kontakte", null)).toBe("401");
  });

  it("lässt Anonyme nicht in /einstellungen (früher pauschal erlaubt)", () => {
    expect(verdict("/einstellungen", null)).toBe("anmelden");
    expect(verdict("/einstellungen/ki", null)).toBe("anmelden");
  });

  it("erlaubt Kanzleirollen die Kanzleioberfläche", () => {
    for (const role of ["ADMIN", "ANWALT", "SACHBEARBEITER", "SEKRETARIAT"]) {
      expect(verdict("/akten", as(role))).toBe("erlaubt");
      expect(verdict("/api/kontakte", as(role))).toBe("erlaubt");
    }
  });
});

describe("Middleware: Mandanten bleiben im Portal", () => {
  it("leitet Mandanten von Kanzleiseiten ins Portal um", () => {
    expect(verdict("/akten", as("MANDANT"))).toBe("weiter:/portal/dashboard");
    expect(verdict("/dashboard", as("MANDANT"))).toBe("weiter:/portal/dashboard");
    expect(verdict("/einstellungen", as("MANDANT"))).toBe("weiter:/portal/dashboard");
  });

  it("verweigert Mandanten Kanzlei-APIs mit 403", () => {
    expect(verdict("/api/kontakte", as("MANDANT"))).toBe("verboten");
    expect(verdict("/api/akten/abc", as("MANDANT"))).toBe("verboten");
    expect(verdict("/api/ki-chat", as("MANDANT"))).toBe("verboten");
    expect(verdict("/api/search?q=x", as("MANDANT"))).toBe("verboten");
  });

  it("erlaubt Mandanten das Portal und die Portal-APIs", () => {
    expect(verdict("/portal/dashboard", as("MANDANT"))).toBe("erlaubt");
    expect(verdict("/portal/akten/abc", as("MANDANT"))).toBe("erlaubt");
    expect(verdict("/api/portal/akten", as("MANDANT"))).toBe("erlaubt");
    expect(verdict("/api/portal/akten/abc/messages", as("MANDANT"))).toBe("erlaubt");
  });

  it("verwechselt Präfixe nicht (/portalx ist nicht /portal)", () => {
    expect(verdict("/portalx", as("MANDANT"))).toBe("weiter:/portal/dashboard");
    expect(verdict("/api/portalx", as("MANDANT"))).toBe("verboten");
  });
});

describe("Middleware: Zwei-Faktor-Pflicht", () => {
  it("leitet Pflichtrollen ohne TOTP zur Einrichtung um, außer in /einstellungen", () => {
    process.env.TOTP_REQUIRED_ROLES = "ADMIN, ANWALT";
    expect(verdict("/akten", as("ANWALT"))).toBe("weiter:/2fa-setup-required");
    expect(verdict("/einstellungen", as("ANWALT"))).toBe("erlaubt");
    expect(verdict("/akten", as("ANWALT", { totpEnabled: true }))).toBe("erlaubt");
    expect(verdict("/akten", as("SACHBEARBEITER"))).toBe("erlaubt");
  });
});

describe("Middleware: welche Pfade sie überhaupt sieht", () => {
  it("prüft Helena-Chat und KI-Routen (früher per Präfix api/ki ausgenommen)", () => {
    expect(matcher.test("/api/ki-chat")).toBe(true);
    expect(matcher.test("/api/ki-entwuerfe")).toBe(true);
    expect(matcher.test("/api/ki/usage")).toBe(true);
  });

  it("lässt öffentliche Seiten und Auth-Endpunkte aus", () => {
    for (const p of ["/login", "/portal/login", "/portal/activate", "/api/auth/session", "/api/health", "/_next/static/x.js", "/brand/app/favicon.svg", "/brand/app/site.webmanifest", "/brand/logos/wordmark-primary.svg"]) {
      expect(matcher.test(p)).toBe(false);
    }
  });

  it("prüft Kanzlei- und Portalseiten", () => {
    for (const p of ["/akten", "/dashboard", "/einstellungen", "/portal/dashboard", "/api/kontakte"]) {
      expect(matcher.test(p)).toBe(true);
    }
  });

  it("verwechselt Präfixe nicht (/login-hilfe, /api/healthz werden geprüft)", () => {
    expect(matcher.test("/login-hilfe")).toBe(true);
    expect(matcher.test("/api/healthz")).toBe(true);
    expect(matcher.test("/branding")).toBe(true);
  });
});
