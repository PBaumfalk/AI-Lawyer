import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { buildGesendetNachricht, buildEebBestaetigung, beaNachrichtSchema, type BeaVersandFormular } from "../versand";
import { beaSendMessage, beaSendEeb, resetBeaLib, type BeaSession } from "../client";

const form: BeaVersandFormular = {
  betreff: "Klage",
  inhalt: "",
  absender: "RA Muster",
  safeIdAbsender: "DE.BRAK.1",
  empfaenger: "AG Köln",
  safeIdEmpfaenger: "DE.JUSTIZ.2",
  dokumentIds: ["d1"],
  anhaenge: [{ name: "Klage.pdf", mimeType: "application/pdf", dokumentId: "d1" }],
};
const session = (): BeaSession => ({ sessionKeys: {}, safeId: "DE.BRAK.1", displayName: "RA", createdAt: Date.now(), lastActivity: Date.now() });

afterEach(() => {
  delete (globalThis as any).window;
  resetBeaLib();
});

describe("beA-Versand: nur bestätigter Versand wird als GESENDET gespeichert", () => {
  it("fehlende bea.expert-Bibliothek: Versand scheitert ehrlich, kein Datensatz", async () => {
    const r = await beaSendMessage(session(), { recipientSafeId: "x", subject: "s", body: "", attachments: [] });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("LIB_NOT_LOADED");
    expect(() => buildGesendetNachricht(r, form)).toThrow(/Bibliothek/);
  });

  it("Bibliothek antwortet ohne Nachrichten-ID: kein Erfolg", async () => {
    (globalThis as any).window = { beaExpert: { sendMessage: async () => ({}) } };
    const r = await beaSendMessage(session(), { recipientSafeId: "x", subject: "s", body: "", attachments: [] });
    expect(r.ok).toBe(false);
    expect(() => buildGesendetNachricht(r, form)).toThrow();
    expect(() => buildGesendetNachricht({ ok: true, data: { nachrichtenId: "  " } }, form)).toThrow();
  });

  it("bestätigter Versand ergibt einen gültigen GESENDET-Datensatz mit ID", async () => {
    (globalThis as any).window = { beaExpert: { sendMessage: async () => ({ messageId: "bea-123" }) } };
    const r = await beaSendMessage(session(), { recipientSafeId: "x", subject: "s", body: "", attachments: [] });
    const rec = buildGesendetNachricht(r, form);
    expect(rec).toMatchObject({ status: "GESENDET", nachrichtenId: "bea-123", dokumentIds: ["d1"] });
    expect(beaNachrichtSchema.safeParse(rec).success).toBe(true);
  });

  it("Server-Schema lehnt GESENDET ohne Nachrichten-ID ab", () => {
    expect(beaNachrichtSchema.safeParse({ betreff: "b", absender: "a", empfaenger: "e", status: "GESENDET" }).success).toBe(false);
  });
});

describe("eEB: nur bei Bestätigung durch bea.expert", () => {
  it("fehlende Bibliothek → kein eEB-Datensatz", async () => {
    const r = await beaSendEeb(session(), "bea-1", new Date());
    expect(r.ok).toBe(false);
    expect(() => buildEebBestaetigung(r, "bea-1", new Date())).toThrow();
  });

  it("bestätigtes eEB → Datensatz mit Nachrichten-ID und Datum", async () => {
    (globalThis as any).window = { beaExpert: { eEBanswer: async () => undefined } };
    const d = new Date("2026-11-18T10:00:00Z");
    const r = await beaSendEeb(session(), "bea-1", d);
    expect(buildEebBestaetigung(r, "bea-1", d)).toEqual({ nachrichtenId: "bea-1", eebDatum: d.toISOString() });
  });
});

describe("beA-Seiten liegen im BeaSessionProvider", () => {
  const dir = path.resolve(__dirname, "../../../app/(dashboard)/bea");
  it("Layout stellt den Provider für /bea, /bea/compose und /bea/[id]", () => {
    const layout = fs.readFileSync(path.join(dir, "layout.tsx"), "utf8");
    expect(layout).toMatch(/<BeaSessionProvider>\s*\{children\}\s*<\/BeaSessionProvider>/);
    for (const p of ["compose/page.tsx", "[id]/page.tsx", "page.tsx"]) {
      expect(fs.existsSync(path.join(dir, p))).toBe(true);
    }
    // a second provider in a page would split the session again
    expect(fs.readFileSync(path.join(dir, "page.tsx"), "utf8")).not.toMatch(/<BeaSessionProvider/);
  });
});
