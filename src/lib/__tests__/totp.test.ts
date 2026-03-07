import { describe, it, expect } from "vitest";
import { authenticator } from "otplib";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "../totp";

describe("TOTP Service", () => {
  describe("generateTotpSecret", () => {
    it("returns a base32 secret, otpauth URL, and QR code data URL", async () => {
      const result = await generateTotpSecret("test@example.com");
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThanOrEqual(20);
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(result.otpauthUrl).toContain("test%40example.com");
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("verifyTotpCode", () => {
    it("returns true for a valid current TOTP code", () => {
      const secret = authenticator.generateSecret(20);
      const code = authenticator.generate(secret);
      expect(verifyTotpCode(secret, code)).toBe(true);
    });

    it("returns false for an invalid code", () => {
      const secret = authenticator.generateSecret(20);
      expect(verifyTotpCode(secret, "000000")).toBe(false);
    });
  });

  describe("generateBackupCodes", () => {
    it("generates 10 codes by default", async () => {
      const result = await generateBackupCodes();
      expect(result.plain).toHaveLength(10);
      expect(result.hashed).toHaveLength(10);
    });

    it("generates the requested number of codes", async () => {
      const result = await generateBackupCodes(3);
      expect(result.plain).toHaveLength(3);
      expect(result.hashed).toHaveLength(3);
    });

    it("generates 8-char alphanumeric codes", async () => {
      const result = await generateBackupCodes(5);
      for (const code of result.plain) {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-Z2-9]+$/);
      }
    });

    it("hashed codes are bcrypt hashes", async () => {
      const result = await generateBackupCodes(1);
      expect(result.hashed[0]).toMatch(/^\$2[aby]?\$/);
    });
  });

  describe("verifyBackupCode", () => {
    it("returns valid=true and removes matched code", async () => {
      const { plain, hashed } = await generateBackupCodes(3);
      const result = await verifyBackupCode(plain[1], hashed);
      expect(result.valid).toBe(true);
      expect(result.remainingCodes).toHaveLength(2);
    });

    it("returns valid=false for wrong code", async () => {
      const { hashed } = await generateBackupCodes(3);
      const result = await verifyBackupCode("WRONGCOD", hashed);
      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toHaveLength(3);
    });
  });
});
