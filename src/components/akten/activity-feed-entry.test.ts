import { describe, it, expect } from "vitest";
import { sanitizeTitel, sanitizeInhalt } from "./activity-feed-entry";

describe("sanitizeTitel", () => {
  it("translates status enum values in status change titles", () => {
    expect(sanitizeTitel("Status geaendert: OFFEN → IN_BEARBEITUNG")).toBe(
      "Status geaendert: Offen → In Bearbeitung"
    );
  });

  it("translates role enum values", () => {
    expect(sanitizeTitel("Beteiligter hinzugefuegt: MANDANT")).toBe(
      "Beteiligter hinzugefuegt: Mandant"
    );
  });

  it("preserves existing mimeType handling", () => {
    expect(sanitizeTitel("mimeType: application/pdf")).toBe("PDF hochgeladen");
  });

  it("leaves normal text unchanged", () => {
    expect(sanitizeTitel("Normale Beschreibung")).toBe("Normale Beschreibung");
  });

  it("translates role enum GEGNERVERTRETER", () => {
    expect(sanitizeTitel("Status: GEGNERVERTRETER")).toBe(
      "Status: Gegnervertreter"
    );
  });

  it("translates ABGESCHLOSSEN status", () => {
    expect(sanitizeTitel("Akte ABGESCHLOSSEN")).toBe("Akte Abgeschlossen");
  });

  it("translates GEGNER role", () => {
    expect(sanitizeTitel("Rolle: GEGNER")).toBe("Rolle: Gegner");
  });

  it("translates multiple enum values in one string", () => {
    expect(sanitizeTitel("LAUFEND nach ABGESCHLOSSEN")).toBe(
      "Laufend nach Abgeschlossen"
    );
  });
});

describe("sanitizeInhalt", () => {
  it("returns null for null input", () => {
    expect(sanitizeInhalt(null)).toBeNull();
  });

  it("strips mimeType lines and translates enums", () => {
    const input = "mimeType: application/pdf\nStatus: OFFEN";
    expect(sanitizeInhalt(input)).toBe("Status: Offen");
  });

  it("translates role enums in body text", () => {
    expect(sanitizeInhalt("Rolle geaendert: MANDANT → GEGNER")).toBe(
      "Rolle geaendert: Mandant → Gegner"
    );
  });
});
