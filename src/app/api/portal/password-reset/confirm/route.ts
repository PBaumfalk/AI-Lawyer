import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";

// Password: min 8 chars, at least 1 uppercase, at least 1 number
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * POST /api/portal/password-reset/confirm
 *
 * Public endpoint -- sets a new password using a reset token.
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
        { error: "Link ungueltig oder abgelaufen" },
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

    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
        role: "MANDANT",
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Link ungueltig oder abgelaufen" },
        { status: 400 }
      );
    }

    // Hash new password and clear reset token
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Audit log
    await logAuditEvent({
      userId: user.id,
      aktion: "PORTAL_PASSWORT_RESET",
      details: { email: user.email },
    }).catch(() => {});

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es spaeter erneut." },
      { status: 500 }
    );
  }
}
