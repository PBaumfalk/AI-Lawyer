import { authenticator } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { encryptCredential, decryptCredential } from "@/lib/email/crypto";

const APP_NAME = "AI-Lawyer";
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export async function generateTotpSecret(userEmail: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const secret = authenticator.generateSecret(20); // 160-bit = 32 base32 chars
  const otpauthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

const SECRET_PREFIX = "enc:v1:";

/** Encrypt a TOTP secret for storage in users.totpSecret. */
export function sealTotpSecret(secret: string): string {
  return SECRET_PREFIX + encryptCredential(secret);
}

/**
 * Read a stored TOTP secret. Secrets saved before encryption was introduced
 * are base32 plaintext and are returned unchanged.
 */
export function openTotpSecret(stored: string): string {
  return stored.startsWith(SECRET_PREFIX)
    ? decryptCredential(stored.slice(SECRET_PREFIX.length))
    : stored;
}

export function verifyTotpCode(secret: string, code: string): boolean {
  authenticator.options = { window: 1 }; // allow 1 step tolerance
  // Accept stored (possibly encrypted) secrets directly.
  return authenticator.verify({ token: code, secret: openTotpSecret(secret) });
}

export async function generateBackupCodes(count = 10): Promise<{
  plain: string[];
  hashed: string[];
}> {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      // CSPRNG: backup codes replace the second factor, Math.random() is predictable.
      code += BACKUP_CODE_CHARS[randomInt(BACKUP_CODE_CHARS.length)];
    }
    plain.push(code);
  }
  const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashed };
}

/**
 * Backup codes are 8 characters from BACKUP_CODE_CHARS (upper case, no
 * separator). Users type them with spaces/hyphens ("abcd-2345") or in lower
 * case; normalise before comparing against the bcrypt hashes.
 */
export function normalizeBackupCode(input: string): string {
  return input.replace(/[\s\-_]/g, "").toUpperCase();
}

export async function verifyBackupCode(
  plain: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  const code = normalizeBackupCode(plain);
  if (code.length !== BACKUP_CODE_LENGTH) return { valid: false, remainingCodes: hashedCodes };
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]);
    if (match) {
      const remainingCodes = hashedCodes.filter((_, idx) => idx !== i);
      return { valid: true, remainingCodes };
    }
  }
  return { valid: false, remainingCodes: hashedCodes };
}
