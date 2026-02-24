import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { encryptCredential } from "@/lib/email/crypto";
import { syncFolders } from "@/lib/email/imap/folder-sync";

const createSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  emailAdresse: z.string().email("Ungültige E-Mail-Adresse"),
  benutzername: z.string().min(1, "Benutzername ist erforderlich"),
  passwort: z.string().optional(),
  authTyp: z.enum(["PASSWORT", "OAUTH2"]).default("PASSWORT"),
  imapHost: z.string().min(1, "IMAP-Host ist erforderlich"),
  imapPort: z.number().int().default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().min(1, "SMTP-Host ist erforderlich"),
  smtpPort: z.number().int().default(587),
  smtpSecure: z.boolean().default(false),
  istKanzlei: z.boolean().default(false),
  initialSync: z.enum(["NUR_NEUE", "DREISSIG_TAGE", "ALLES"]).default("DREISSIG_TAGE"),
  softDeleteTage: z.number().int().min(0).default(30),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const isAdmin = (session.user as any).role === "ADMIN";

  let konten;
  if (isAdmin) {
    // Admin sees all mailboxes
    konten = await prisma.emailKonto.findMany({
      select: {
        id: true,
        name: true,
        emailAdresse: true,
        istKanzlei: true,
        aktiv: true,
        syncStatus: true,
        letzterSync: true,
        fehlerLog: true,
        authTyp: true,
        imapHost: true,
        smtpHost: true,
        createdAt: true,
        _count: { select: { nachrichten: true, zuweisungen: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Non-admin sees only assigned mailboxes
    konten = await prisma.emailKonto.findMany({
      where: {
        zuweisungen: { some: { userId: session.user.id } },
        aktiv: true,
      },
      select: {
        id: true,
        name: true,
        emailAdresse: true,
        istKanzlei: true,
        aktiv: true,
        syncStatus: true,
        letzterSync: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return Response.json(konten);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if ((session.user as any).role !== "ADMIN") {
    return Response.json(
      { error: "Nur Administratoren können E-Mail-Konten erstellen" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Encrypt password before storing
  let passwortEnc: string | null = null;
  if (data.authTyp === "PASSWORT" && data.passwort) {
    passwortEnc = encryptCredential(data.passwort);
  }

  const konto = await prisma.emailKonto.create({
    data: {
      name: data.name,
      emailAdresse: data.emailAdresse,
      benutzername: data.benutzername,
      passwortEnc,
      authTyp: data.authTyp,
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      imapSecure: data.imapSecure,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      istKanzlei: data.istKanzlei,
      initialSync: data.initialSync,
      softDeleteTage: data.softDeleteTage,
    },
    select: {
      id: true,
      name: true,
      emailAdresse: true,
      istKanzlei: true,
      aktiv: true,
      syncStatus: true,
      createdAt: true,
    },
  });

  return Response.json(konto, { status: 201 });
}
