/**
 * Email signature template rendering with placeholder substitution.
 * Admin defines a kanzlei-wide HTML template; each user's profile data fills the placeholders.
 */

import { prisma } from "@/lib/db";

export interface SignatureUserData {
  name: string;
  titel?: string | null;
  mobil?: string | null;
  durchwahl?: string | null;
  email: string;
}

/**
 * Replace {{placeholder}} tokens in the signature HTML template with user data.
 * Returns rendered HTML string. If template is null/empty, returns empty string.
 */
export function renderSignature(
  template: string | null | undefined,
  userData: SignatureUserData
): string {
  if (!template) return "";

  return template
    .replace(/\{\{name\}\}/g, userData.name || "")
    .replace(/\{\{titel\}\}/g, userData.titel || "")
    .replace(/\{\{mobil\}\}/g, userData.mobil || "")
    .replace(/\{\{durchwahl\}\}/g, userData.durchwahl || "")
    .replace(/\{\{email\}\}/g, userData.email || "");
}

/**
 * Load kanzlei signature template from EmailKonto.signaturVorlage,
 * load user profile data, render and return the personalized signature HTML.
 */
export async function getSignatureForUser(
  userId: string,
  kontoId: string
): Promise<string> {
  // Load signature template from the mailbox
  const konto = await prisma.emailKonto.findUnique({
    where: { id: kontoId },
    select: { signaturVorlage: true },
  });

  if (!konto?.signaturVorlage) return "";

  // Load user profile — titel/mobil/durchwahl are stored in User.position/telefon
  // or may be added to User model later. For now, use available fields.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      position: true,
      telefon: true,
    },
  });

  if (!user) return "";

  return renderSignature(konto.signaturVorlage, {
    name: user.name || "",
    titel: user.position ?? null,
    mobil: user.telefon ?? null,
    durchwahl: user.telefon ?? null,
    email: user.email || "",
  });
}
