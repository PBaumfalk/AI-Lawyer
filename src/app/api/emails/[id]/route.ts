import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getDownloadUrl } from "@/lib/storage";

/**
 * GET /api/emails/[id] — Return full email detail including HTML body,
 * attachments with presigned download URLs, veraktungen.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const isAdmin = (session.user as any).role === "ADMIN";

  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    include: {
      emailKonto: {
        select: { id: true, name: true, emailAdresse: true },
      },
      emailOrdner: {
        select: { id: true, name: true, pfad: true, spezialTyp: true },
      },
      anhaenge: true,
      veraktungen: {
        where: { aufgehoben: false },
        include: {
          akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
          user: { select: { id: true, name: true } },
        },
      },
      verantwortlich: {
        select: { id: true, name: true, email: true },
      },
      ticket: {
        select: { id: true, titel: true, status: true, prioritaet: true },
      },
    },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Verify user has access to this email's mailbox
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId: email.emailKontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff auf diese E-Mail" }, { status: 403 });
    }
  }

  // Generate presigned URLs for attachments
  const attachmentsWithUrls = await Promise.all(
    email.anhaenge.map(async (att) => {
      let downloadUrl: string | null = null;
      try {
        downloadUrl = await getDownloadUrl(att.speicherPfad);
      } catch {
        // MinIO may not be available; return null URL
      }
      return {
        id: att.id,
        dateiname: att.dateiname,
        mimeType: att.mimeType,
        groesse: att.groesse,
        contentId: att.contentId,
        downloadUrl,
      };
    })
  );

  return Response.json({
    ...email,
    anhaenge: attachmentsWithUrls,
  });
}

/**
 * DELETE /api/emails/[id] — Soft-delete email.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    select: { emailKontoId: true },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  // Verify access
  const isAdmin = (session.user as any).role === "ADMIN";
  if (!isAdmin) {
    const hasAccess = await prisma.emailKontoZuweisung.findFirst({
      where: { kontoId: email.emailKontoId, userId: session.user.id },
    });
    if (!hasAccess) {
      return Response.json({ error: "Kein Zugriff" }, { status: 403 });
    }
  }

  // Soft delete
  await prisma.emailNachricht.update({
    where: { id },
    data: {
      geloescht: true,
      geloeschtAm: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
