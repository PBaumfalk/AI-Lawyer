import { authenticator } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

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

export function verifyTotpCode(secret: string, code: string): boolean {
  authenticator.options = { window: 1 }; // allow 1 step tolerance
  return authenticator.verify({ token: code, secret });
}

export async function generateBackupCodes(count = 10): Promise<{
  plain: string[];
  hashed: string[];
}> {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += BACKUP_CODE_CHARS[Math.floor(Math.random() * BACKUP_CODE_CHARS.length)];
    }
    plain.push(code);
  }
  const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashed };
}

export async function verifyBackupCode(
  plain: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(plain, hashedCodes[i]);
    if (match) {
      const remainingCodes = hashedCodes.filter((_, idx) => idx !== i);
      return { valid: true, remainingCodes };
    }
  }
  return { valid: false, remainingCodes: hashedCodes };
}
