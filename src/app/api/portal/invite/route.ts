/**
 * POST /api/portal/invite
 *
 * Creates a portal invitation for a Mandant-Beteiligter.
 * Only ANWALT and ADMIN roles can send invitations.
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

export async function POST(req: NextRequest) {
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
      { error: "Keine Berechtigung. Nur Anwaelte und Admins koennen Einladungen versenden." },
      { status: 403 }
    );
  }

  // --- Parse body ---
  let body: { beteiligteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { beteiligteId } = body;
  if (!beteiligteId) {
    return NextResponse.json(
      { error: "beteiligteId ist erforderlich" },
      { status: 400 }
    );
  }

  // --- Load Beteiligter with Kontakt and Akte ---
  const beteiligter = await prisma.beteiligter.findUnique({
    where: { id: beteiligteId },
    include: {
      kontakt: true,
      akte: {
        include: {
          kanzlei: { select: { name: true } },
        },
      },
    },
  });

  if (!beteiligter) {
    return NextResponse.json(
      { error: "Beteiligter nicht gefunden" },
      { status: 404 }
    );
  }

  // --- Validate rolle is MANDANT ---
  if (beteiligter.rolle !== "MANDANT") {
    return NextResponse.json(
      { error: "Nur Beteiligte mit Rolle MANDANT koennen eingeladen werden" },
      { status: 400 }
    );
  }

  // --- Validate email ---
  const kontaktEmail = beteiligter.kontakt.email;
  if (!kontaktEmail) {
    return NextResponse.json(
      { error: "Kontakt hat keine E-Mail-Adresse. Bitte zuerst eine E-Mail hinterlegen." },
      { status: 400 }
    );
  }

  // --- Check if Kontakt already has a portal User ---
  const existingPortalUser = await prisma.user.findFirst({
    where: {
      role: "MANDANT",
      kontaktId: beteiligter.kontaktId,
    },
  });

  if (existingPortalUser) {
    return NextResponse.json(
      { error: "Mandant hat bereits einen Portal-Account" },
      { status: 400 }
    );
  }

  // --- Revoke any active (PENDING + not expired) invites for this Beteiligter ---
  await prisma.portalInvite.updateMany({
    where: {
      beteiligteId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: { status: "REVOKED" },
  });

  // --- Create new invite ---
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const invite = await prisma.portalInvite.create({
    data: {
      token,
      beteiligteId,
      kontaktId: beteiligter.kontaktId,
      email: kontaktEmail,
      expiresAt,
      createdById: session.user.id,
    },
  });

  // --- Build activation URL ---
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const activationUrl = `${baseUrl}/portal/activate?token=${token}`;

  // --- Resolve names for email ---
  const mandantName =
    [beteiligter.kontakt.vorname, beteiligter.kontakt.nachname]
      .filter(Boolean)
      .join(" ") ||
    beteiligter.kontakt.firma ||
    "Mandant";

  const kanzleiName = beteiligter.akte.kanzlei?.name ?? "Ihre Kanzlei";
  const aktenzeichen = beteiligter.akte.aktenzeichen;

  // --- Send email ---
  const emailContent = portalInviteEmail({
    mandantName,
    kanzleiName,
    aktenzeichen,
    activationUrl,
  });

  await sendEmail({
    to: kontaktEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  // --- Audit log ---
  await logAuditEvent({
    userId: session.user.id,
    akteId: beteiligter.akteId,
    aktion: "PORTAL_EINLADUNG",
    details: {
      kontaktId: beteiligter.kontaktId,
      beteiligteId,
      email: kontaktEmail,
      inviteId: invite.id,
    },
  }).catch(() => {
    // Audit logging should not block the response
  });

  return NextResponse.json(
    {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      expiresAt: invite.expiresAt,
    },
    { status: 201 }
  );
}
