/**
 * At-rest encryption for j-lawyer credentials stored in SystemSetting.
 * Reuses the AES-256-GCM credential crypto from the email module
 * (key derived from EMAIL_ENCRYPTION_KEY).
 */

import { encryptCredential, decryptCredential } from "@/lib/email/crypto";

/** Encrypt a j-lawyer password for storage in SystemSetting. */
export function encryptJLawyerPassword(plaintext: string): string {
  return encryptCredential(plaintext);
}

/**
 * Decrypt a stored j-lawyer password.
 * Falls back to the raw value for legacy plaintext entries saved before
 * encryption was introduced, so existing installs keep working.
 */
export function decryptJLawyerPassword(stored: string): string {
  try {
    return decryptCredential(stored);
  } catch {
    return stored;
  }
}
