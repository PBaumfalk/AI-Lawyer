/**
 * POST /api/portal/invite/[id]/resend
 *
 * Resends an existing portal invitation email.
 * If the invite has expired, creates a new one and sends it.
 * Only ANWALT and ADMIN roles can resend invitations.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { portalInviteEmail } from "@/lib/email/templates/portal-invite";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

const ALLOWED_ROLES: UserRole[] = ["ANWALT", "ADMIN"];
const INVITE_EXPIRY_DAYS = 7;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // --- Auth ---
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const role = (session.user as any).role as UserRole;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    );
  }

  // --- Find invite ---
  const invite = await prisma.portalInvite.findUnique({
    where: { id },
    include: {
      beteiligter: {
        include: {
          kontakt: true,
          akte: {
            include: { kanzlei: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!invite) {
    return NextResponse.json(
      { error: "Einladung nicht gefunden" },
      { status: 404 }
    );
  }

  // --- Check status ---
  if (invite.status === "ACCEPTED") {
    return NextResponse.json(
      { error: "Einladung wurde bereits angenommen" },
      { status: 400 }
    );
  }

  if (invite.status === "REVOKED") {
    return NextResponse.json(
      { error: "Einladung wurde widerrufen" },
      { status: 400 }
    );
  }

  // --- Resolve names for email ---
  const mandantName =
    [invite.beteiligter.kontakt.vorname, invite.beteiligter.kontakt.nachname]
      .filter(Boolean)
      .join(" ") ||
    invite.beteiligter.kontakt.firma ||
    "Mandant";

  const kanzleiName =
    invite.beteiligter.akte.kanzlei?.name ?? "Ihre Kanzlei";
  const aktenzeichen = invite.beteiligter.akte.aktenzeichen;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  let resultInvite = invite;

  // --- If expired, mark expired and create a new invite ---
  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    await prisma.portalInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });

    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const newInvite = await prisma.portalInvite.create({
      data: {
        token: newToken,
        beteiligteId: invite.beteiligteId,
        kontaktId: invite.kontaktId,
        email: invite.email,
        expiresAt,
        createdById: session.user.id,
      },
    });

    const activationUrl = `${baseUrl}/portal/activate?token=${newToken}`;
    const emailContent = portalInviteEmail({
      mandantName,
      kanzleiName,
      aktenzeichen,
      activationUrl,
    });

    await sendEmail({
      to: invite.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    resultInvite = { ...invite, ...newInvite } as typeof invite;
  } else {
    // --- Still valid, just resend ---
    const activationUrl = `${baseUrl}/portal/activate?token=${invite.token}`;
    const emailContent = portalInviteEmail({
      mandantName,
      kanzleiName,
      aktenzeichen,
      activationUrl,
    });

    await sendEmail({
      to: invite.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  }

  // --- Audit log ---
  await logAuditEvent({
    userId: session.user.id,
    akteId: invite.beteiligter.akteId,
    aktion: "PORTAL_EINLADUNG_ERNEUT",
    details: {
      inviteId: resultInvite.id,
      email: invite.email,
      wasExpired: invite.expiresAt < new Date(),
    },
  }).catch(() => {
    // Audit logging should not block the response
  });

  return NextResponse.json({
    id: resultInvite.id,
    token: resultInvite.token,
    email: resultInvite.email,
    expiresAt: resultInvite.expiresAt,
    status: resultInvite.status,
  });
}
