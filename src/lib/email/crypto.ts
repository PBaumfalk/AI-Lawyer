/**
 * AES-256-GCM credential encryption for IMAP/SMTP passwords.
 * Uses Node.js built-in crypto module only.
 *
 * Storage format: iv:authTag:ciphertext (hex-encoded, colon-separated)
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT = "ai-lawyer-email-cred-v1"; // Fixed salt for deterministic key derivation

/**
 * Derive a 256-bit key from the EMAIL_ENCRYPTION_KEY env var.
 * Uses scryptSync for key derivation.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.EMAIL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein. " +
      "Bitte in .env setzen."
    );
  }
  return scryptSync(secret, SALT, KEY_LENGTH);
}

/**
 * Encrypt a plaintext credential using AES-256-GCM.
 * @returns Encrypted string in format: iv:authTag:ciphertext (hex)
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a stored credential from the iv:authTag:ciphertext format.
 * @returns Decrypted plaintext string
 */
export function decryptCredential(stored: string): string {
  const key = getEncryptionKey();
  const parts = stored.split(":");

  if (parts.length !== 3) {
    throw new Error("Ungültiges verschlüsseltes Format. Erwartet: iv:authTag:ciphertext");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = Buffer.from(parts[2], "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
