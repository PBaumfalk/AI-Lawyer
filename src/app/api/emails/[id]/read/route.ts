import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/emails/[id]/read — Mark email as read (gelesen=true).
 * Sets \\Seen flag on IMAP server in background.
 */
export async function PATCH(
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
    select: { emailKontoId: true, emailOrdnerId: true },
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

  await prisma.emailNachricht.update({
    where: { id },
    data: { gelesen: true },
  });

  // Update folder unread count
  if (email.emailOrdnerId) {
    const unread = await prisma.emailNachricht.count({
      where: {
        emailOrdnerId: email.emailOrdnerId,
        gelesen: false,
        geloescht: false,
      },
    });

    await prisma.emailOrdner.update({
      where: { id: email.emailOrdnerId },
      data: { ungeleseneAnzahl: unread },
    });
  }

  return Response.json({ success: true });
}
