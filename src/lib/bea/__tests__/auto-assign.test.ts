import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the module
vi.mock("@/lib/db", () => ({
  prisma: {
    akte: {
      findMany: vi.fn(),
    },
    kontakt: {
      findMany: vi.fn(),
    },
  },
}));

import { autoAssignToAkte } from "../auto-assign";
import { prisma } from "@/lib/db";

const mockAkteFindMany = vi.mocked(prisma.akte.findMany);
const mockKontaktFindMany = vi.mocked(prisma.kontakt.findMany);

beforeEach(() => {
  vi.resetAllMocks();
  // Default: no matches for both
  mockAkteFindMany.mockResolvedValue([] as any);
  mockKontaktFindMany.mockResolvedValue([] as any);
});

describe("autoAssignToAkte", () => {
  describe("Strategy 1: Aktenzeichen match in betreff", () => {
    it("should return SICHER when Aktenzeichen found in betreff matches exactly one Akte", async () => {
      // Internal AZ "00001/26" found -> findMany called once
      mockAkteFindMany.mockResolvedValueOnce([
        { id: "akte-1", aktenzeichen: "00001/26", kurzrubrum: "Mueller ./. Schmidt" },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Ihre Akte 00001/26 - Neue Dokumente",
        absender: "RA Meier",
        inhalt: null,
      });

      expect(result.akteId).toBe("akte-1");
      expect(result.confidence).toBe("SICHER");
      expect(result.reason).toContain("00001/26");
      expect(result.reason).toContain("Mueller ./. Schmidt");
    });

    it("should match Aktenzeichen in inhalt when not in betreff", async () => {
      // The combined text "Allgemeine Anfrage Bezugnehmend auf die Akte 00042/25..."
      // Internal AZ "00042/25" found in combined text
      mockAkteFindMany.mockResolvedValueOnce([
        { id: "akte-2", aktenzeichen: "00042/25", kurzrubrum: "Becker ./. Lehmann" },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Allgemeine Anfrage",
        absender: "RA Schmidt",
        inhalt: "Bezugnehmend auf die Akte 00042/25 moechten wir...",
      });

      expect(result.akteId).toBe("akte-2");
      expect(result.confidence).toBe("SICHER");
    });

    it("should return WAHRSCHEINLICH when multiple Aktenzeichen match", async () => {
      // Internal AZ "00001/26" and "00002/26" found -> findMany returns both
      mockAkteFindMany.mockResolvedValueOnce([
        { id: "akte-1", aktenzeichen: "00001/26", kurzrubrum: "Fall A" },
        { id: "akte-2", aktenzeichen: "00002/26", kurzrubrum: "Fall B" },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Akten 00001/26 und 00002/26",
        absender: "RA Meier",
        inhalt: null,
      });

      expect(result.akteId).toBe("akte-1");
      expect(result.confidence).toBe("WAHRSCHEINLICH");
      expect(result.reason).toContain("Mehrere");
    });
  });

  describe("Strategy 2: SAFE-ID match via Kontakt", () => {
    it("should return WAHRSCHEINLICH when sender SAFE-ID matches a Kontakt linked to one Akte", async () => {
      // No internal AZ in "Vergleichsvorschlag" -> matchByAktenzeichen skipped (no regex match)
      // SAFE-ID match via Kontakt
      mockKontaktFindMany.mockResolvedValueOnce([
        {
          id: "kontakt-1",
          nachname: "Gegner",
          firma: null,
          beteiligte: [
            {
              akteId: "akte-3",
              rolle: "GEGNER",
              akte: {
                id: "akte-3",
                aktenzeichen: "00010/26",
                kurzrubrum: "Mandant ./. Gegner",
                status: "OFFEN",
              },
            },
          ],
        },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Vergleichsvorschlag",
        absender: "RA Gegner",
        inhalt: null,
        safeIdAbsender: "DE.BRAK.xyz789",
      });

      expect(result.akteId).toBe("akte-3");
      expect(result.confidence).toBe("WAHRSCHEINLICH");
      expect(result.reason).toContain("SAFE-ID");
      expect(result.reason).toContain("Gegner");
    });

    it("should return WAHRSCHEINLICH when SAFE-ID matches multiple Akten", async () => {
      // No internal AZ in "Neue Unterlagen" -> skip Aktenzeichen strategy
      mockKontaktFindMany.mockResolvedValueOnce([
        {
          id: "kontakt-1",
          nachname: "Meier",
          firma: null,
          beteiligte: [
            {
              akteId: "akte-1",
              rolle: "MANDANT",
              akte: { id: "akte-1", aktenzeichen: "00001/26", kurzrubrum: "Fall A", status: "OFFEN" },
            },
            {
              akteId: "akte-2",
              rolle: "MANDANT",
              akte: { id: "akte-2", aktenzeichen: "00002/26", kurzrubrum: "Fall B", status: "OFFEN" },
            },
          ],
        },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Neue Unterlagen",
        absender: "Meier",
        inhalt: null,
        safeIdAbsender: "DE.BRAK.meier123",
      });

      expect(result.akteId).toBe("akte-1");
      expect(result.confidence).toBe("WAHRSCHEINLICH");
      expect(result.reason).toContain("2 Akten");
    });
  });

  describe("Strategy 3: Court reference matching", () => {
    it("should return WAHRSCHEINLICH when Gerichtsaktenzeichen matches in falldaten", async () => {
      // No internal AZ in "Ladung zum Termin 3 K 234/25" -> skip AZ strategy
      // No safeIdAbsender -> skip SAFE-ID strategy
      // Court AZ "3 K 234/25" found -> matchByCourtReference calls akte.findMany
      mockAkteFindMany.mockResolvedValueOnce([
        {
          id: "akte-5",
          aktenzeichen: "00050/25",
          kurzrubrum: "Meyer ./. Stadt",
          falldaten: { gerichtsAktenzeichen: "3 K 234/25" },
        },
        {
          id: "akte-6",
          aktenzeichen: "00060/25",
          kurzrubrum: "Anderer Fall",
          falldaten: null,
        },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Ladung zum Termin 3 K 234/25",
        absender: "Verwaltungsgericht Berlin",
        inhalt: null,
      });

      expect(result.akteId).toBe("akte-5");
      expect(result.confidence).toBe("WAHRSCHEINLICH");
      expect(result.reason).toContain("Gerichtsaktenzeichen");
      expect(result.reason).toContain("3 K 234/25");
    });
  });

  describe("No match (UNSICHER)", () => {
    it("should return UNSICHER when no strategy matches", async () => {
      // No internal AZ, no SAFE-ID, no court AZ in text
      // Default mocks return [] for everything

      const result = await autoAssignToAkte({
        betreff: "Allgemeine Information",
        absender: "Unbekannt",
        inhalt: "Dies ist eine allgemeine Nachricht ohne Bezug.",
      });

      expect(result.akteId).toBeNull();
      expect(result.confidence).toBe("UNSICHER");
      expect(result.reason).toContain("Keine automatische Zuordnung");
    });

    it("should return UNSICHER when no SAFE-ID provided and no Aktenzeichen found", async () => {
      const result = await autoAssignToAkte({
        betreff: "Hallo",
        absender: "Test",
        inhalt: null,
        safeIdAbsender: null,
      });

      expect(result.akteId).toBeNull();
      expect(result.confidence).toBe("UNSICHER");
    });
  });

  describe("Priority order", () => {
    it("should prefer Aktenzeichen match over SAFE-ID match", async () => {
      // Internal AZ "00001/26" found -> matchByAktenzeichen calls akte.findMany first
      mockAkteFindMany.mockResolvedValueOnce([
        { id: "akte-az", aktenzeichen: "00001/26", kurzrubrum: "AZ Match" },
      ] as any);

      const result = await autoAssignToAkte({
        betreff: "Akte 00001/26",
        absender: "RA Test",
        inhalt: null,
        safeIdAbsender: "DE.BRAK.test123",
      });

      expect(result.akteId).toBe("akte-az");
      expect(result.confidence).toBe("SICHER");
      // SAFE-ID should not have been checked because AZ matched
      expect(mockKontaktFindMany).not.toHaveBeenCalled();
    });
  });
});
