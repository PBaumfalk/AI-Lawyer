import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { einstellungenUrl, resolveEinstellungenTab, EINSTELLUNGEN_TABS } from "@/lib/einstellungen-tabs";

describe("Einstellungen: ?tab= Deep-Link", () => {
  it("öffnet den Tab aus dem Link der 2FA-Pflichtseite", () => {
    const url = new URL(einstellungenUrl("sicherheit"), "http://x");
    expect(resolveEinstellungenTab(url.searchParams.get("tab"))).toBe("sicherheit");
  });

  it("fällt bei unbekanntem oder nicht sichtbarem Tab auf allgemein zurück", () => {
    expect(resolveEinstellungenTab(null)).toBe("allgemein");
    expect(resolveEinstellungenTab("gibtsnicht")).toBe("allgemein");
    expect(resolveEinstellungenTab("fristen", ["allgemein", "sicherheit"])).toBe("allgemein");
  });

  it("jede Tab-ID existiert auf der Einstellungsseite", () => {
    const page = fs.readFileSync(path.resolve(__dirname, "../../app/(dashboard)/einstellungen/page.tsx"), "utf8");
    for (const t of EINSTELLUNGEN_TABS) expect(page).toContain(`TabsTrigger value="${t}"`);
    expect(page).toContain("resolveEinstellungenTab(");
  });
});
