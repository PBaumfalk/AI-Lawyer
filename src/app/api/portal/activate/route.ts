import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

// Password: min 8 chars, at least 1 uppercase, at least 1 number
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * POST /api/portal/activate
 *
 * Public endpoint -- activates a Mandant portal account using an invite token.
 * Creates a new User with role MANDANT and links it to the Kontakt.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password, passwordConfirm } = body as {
      token?: string;
      password?: string;
      passwordConfirm?: string;
    };

    // Validate input
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Kein Aktivierungstoken angegeben" },
        { status: 400 }
      );
    }

    if (!password || !passwordConfirm) {
      return NextResponse.json(
        { error: "Passwort ist erforderlich" },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Passwoerter stimmen nicht ueberein" },
        { status: 400 }
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          error:
            "Passwort muss mindestens 8 Zeichen, 1 Grossbuchstabe und 1 Zahl enthalten",
        },
        { status: 400 }
      );
    }

    // Find the invite
    const invite = await prisma.portalInvite.findUnique({
      where: { token },
      include: {
        kontakt: true,
      },
    });

    if (!invite || invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Einladung ungueltig oder abgelaufen" },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      // Mark as expired
      await prisma.portalInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Einladung ungueltig oder abgelaufen" },
        { status: 400 }
      );
    }

    // Check if a MANDANT user with this kontaktId already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        role: "MANDANT",
        kontaktId: invite.kontaktId,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Account existiert bereits" },
        { status: 400 }
      );
    }

    // Build display name from Kontakt
    const kontakt = invite.kontakt;
    let displayName = "Mandant";
    if (kontakt.vorname && kontakt.nachname) {
      displayName = `${kontakt.vorname} ${kontakt.nachname}`;
    } else if (kontakt.nachname) {
      displayName = kontakt.nachname;
    } else if (kontakt.firma) {
      displayName = kontakt.firma;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new MANDANT user and update invite in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name: displayName,
          passwordHash,
          role: "MANDANT",
          aktiv: true,
          kontaktId: invite.kontaktId,
        },
      });

      await tx.portalInvite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          usedAt: new Date(),
        },
      });

      return user;
    });

    // Audit log
    await logAuditEvent({
      aktion: "PORTAL_AKTIVIERT",
      details: {
        kontaktId: invite.kontaktId,
        email: invite.email,
        userId: newUser.id,
      },
    }).catch(() => {});

    return NextResponse.json(
      { success: true, email: invite.email },
      { status: 201 }
    );
  } catch (error) {
    console.error("Portal activation error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es spaeter erneut." },
      { status: 500 }
    );
  }
}
