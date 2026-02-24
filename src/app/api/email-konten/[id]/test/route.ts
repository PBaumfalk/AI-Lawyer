import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { decryptCredential } from "@/lib/email/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Nur Administratoren" }, { status: 403 });
  }

  const { id } = await params;

  const konto = await prisma.emailKonto.findUnique({ where: { id } });
  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  // Decrypt password
  let password: string | undefined;
  let accessToken: string | undefined;

  if (konto.authTyp === "PASSWORT" && konto.passwortEnc) {
    try {
      password = decryptCredential(konto.passwortEnc);
    } catch {
      return Response.json({
        imap: { success: false, error: "Passwort konnte nicht entschlüsselt werden" },
        smtp: { success: false, error: "Passwort konnte nicht entschlüsselt werden" },
      });
    }
  } else if (konto.authTyp === "OAUTH2" && konto.oauthTokens) {
    const tokens = typeof konto.oauthTokens === "string"
      ? JSON.parse(konto.oauthTokens)
      : konto.oauthTokens;
    accessToken = (tokens as any).accessToken;
  }

  const results = {
    imap: { success: false, error: null as string | null, folders: 0 },
    smtp: { success: false, error: null as string | null },
  };

  // Test IMAP
  try {
    const client = new ImapFlow({
      host: konto.imapHost,
      port: konto.imapPort,
      secure: konto.imapSecure,
      auth: accessToken
        ? { user: konto.benutzername, accessToken }
        : { user: konto.benutzername, pass: password! },
      logger: false,
    });

    await client.connect();
    const folders = await client.list();
    results.imap.folders = folders.length;
    results.imap.success = true;
    await client.logout();
  } catch (err) {
    results.imap.error = err instanceof Error ? err.message : String(err);
  }

  // Test SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: konto.smtpHost,
      port: konto.smtpPort,
      secure: konto.smtpSecure,
      auth: accessToken
        ? { type: "OAuth2" as const, user: konto.benutzername, accessToken }
        : { user: konto.benutzername, pass: password },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });

    await transporter.verify();
    results.smtp.success = true;
    transporter.close();
  } catch (err) {
    results.smtp.error = err instanceof Error ? err.message : String(err);
  }

  return Response.json(results);
}
