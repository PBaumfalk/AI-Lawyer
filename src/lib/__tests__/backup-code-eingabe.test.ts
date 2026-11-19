import { describe, it, expect } from "vitest";
import { generateBackupCodes, verifyBackupCode } from "@/lib/totp";

describe("Backup-Code-Eingabe ist tolerant", () => {
  it("akzeptiert Bindestriche, Leerzeichen und Kleinbuchstaben", async () => {
    const { plain, hashed } = await generateBackupCodes(3);
    const code = plain[1];
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    const variants = [
      code,
      `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase(),
      ` ${code.slice(0, 4)} ${code.slice(4)} `,
    ];
    for (const v of variants) {
      const r = await verifyBackupCode(v, hashed);
      expect(r.valid).toBe(true);
      expect(r.remainingCodes).toHaveLength(2);
    }
  });

  it("lehnt falsche Codes ab", async () => {
    const { hashed } = await generateBackupCodes(2);
    expect((await verifyBackupCode("", hashed)).valid).toBe(false);
    expect((await verifyBackupCode("ABCD-234", hashed)).valid).toBe(false);
  });
});
