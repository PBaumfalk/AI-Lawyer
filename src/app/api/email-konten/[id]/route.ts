import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { encryptCredential } from "@/lib/email/crypto";
import { stopImapConnection, startImapConnection } from "@/lib/email/imap/connection-manager";
import { invalidateTransport } from "@/lib/email/smtp/transport-factory";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  emailAdresse: z.string().email().optional(),
  benutzername: z.string().min(1).optional(),
  passwort: z.string().optional(),
  authTyp: z.enum(["PASSWORT", "OAUTH2"]).optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().optional(),
  imapSecure: z.boolean().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().optional(),
  smtpSecure: z.boolean().optional(),
  istKanzlei: z.boolean().optional(),
  aktiv: z.boolean().optional(),
  initialSync: z.enum(["NUR_NEUE", "DREISSIG_TAGE", "ALLES"]).optional(),
  softDeleteTage: z.number().int().min(0).optional(),
  signaturVorlage: z.string().nullable().optional(),
  signaturPlaceholders: z.any().optional(),
});

export async function GET(
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

  const konto = await prisma.emailKonto.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      emailAdresse: true,
      benutzername: true,
      authTyp: true,
      imapHost: true,
      imapPort: true,
      imapSecure: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      istKanzlei: true,
      aktiv: true,
      initialSync: true,
      syncStatus: true,
      letzterSync: true,
      fehlerLog: true,
      softDeleteTage: true,
      signaturVorlage: true,
      signaturPlaceholders: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { nachrichten: true, zuweisungen: true, ordner: true } },
    },
  });

  if (!konto) {
    return Response.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  // Never return the encrypted password
  return Response.json(konto);
}

export async function PATCH(
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
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: any = {};

  // Copy simple fields
  for (const key of [
    "name", "emailAdresse", "benutzername", "authTyp",
    "imapHost", "imapPort", "imapSecure",
    "smtpHost", "smtpPort", "smtpSecure",
    "istKanzlei", "aktiv", "initialSync", "softDeleteTage",
    "signaturVorlage", "signaturPlaceholders",
  ] as const) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  // Re-encrypt password if changed
  if (data.passwort) {
    updateData.passwortEnc = encryptCredential(data.passwort);
  }

  const updated = await prisma.emailKonto.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      emailAdresse: true,
      aktiv: true,
      syncStatus: true,
    },
  });

  // If IMAP/SMTP settings changed, restart IMAP connection and invalidate SMTP cache
  const connectionSettingsChanged =
    data.imapHost !== undefined || data.imapPort !== undefined ||
    data.imapSecure !== undefined || data.benutzername !== undefined ||
    data.passwort !== undefined || data.authTyp !== undefined;

  if (connectionSettingsChanged || data.smtpHost !== undefined) {
    invalidateTransport(id);
  }

  if (connectionSettingsChanged) {
    // Restart IMAP connection in background
    const fullKonto = await prisma.emailKonto.findUnique({ where: { id } });
    if (fullKonto && fullKonto.aktiv) {
      // Fire and forget — don't block the response
      startImapConnection(fullKonto).catch(() => {});
    }
  }

  // If deactivated, stop IMAP connection
  if (data.aktiv === false) {
    await stopImapConnection(id);
  }

  return Response.json(updated);
}

export async function DELETE(
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

  // Check if there are emails associated
  const emailCount = await prisma.emailNachricht.count({
    where: { emailKontoId: id },
  });

  if (emailCount > 0) {
    // Soft-deactivate: stop IMAP, set aktiv=false
    await stopImapConnection(id);
    await prisma.emailKonto.update({
      where: { id },
      data: { aktiv: false },
    });
    return Response.json({
      message: "E-Mail-Konto deaktiviert (hat noch verknüpfte E-Mails)",
      deaktiviert: true,
    });
  }

  // Hard delete if no emails
  await stopImapConnection(id);
  await prisma.emailKonto.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
