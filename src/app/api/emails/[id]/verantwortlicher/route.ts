import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/**
 * PATCH /api/emails/[id]/verantwortlicher — Assign Verantwortlicher to an email.
 * Body: { userId: string }
 * Only for emails in Kanzlei mailboxes (istKanzlei=true).
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
  const body = await req.json();
  const { userId } = body;

  if (!userId) {
    return Response.json(
      { error: "userId ist erforderlich" },
      { status: 400 }
    );
  }

  // Verify email exists and is from a Kanzlei mailbox
  const email = await prisma.emailNachricht.findUnique({
    where: { id },
    include: {
      emailKonto: { select: { istKanzlei: true } },
    },
  });

  if (!email) {
    return Response.json({ error: "E-Mail nicht gefunden" }, { status: 404 });
  }

  if (!email.emailKonto.istKanzlei) {
    return Response.json(
      {
        error:
          "Verantwortlicher-Zuweisung nur fuer Kanzlei-Postfaecher moeglich",
      },
      { status: 400 }
    );
  }

  // Verify the target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    return Response.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 }
    );
  }

  await prisma.emailNachricht.update({
    where: { id },
    data: { verantwortlichId: userId },
  });

  await logAuditEvent({
    userId: session.user.id,
    aktion: "EMAIL_VERANTWORTLICHER_GESETZT",
    details: {
      emailNachrichtId: id,
      verantwortlichId: userId,
      verantwortlichName: targetUser.name,
    },
  });

  return Response.json({ success: true, verantwortlich: targetUser });
}
