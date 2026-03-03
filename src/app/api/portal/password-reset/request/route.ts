import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { portalPasswordResetEmail } from "@/lib/email/templates/portal-password-reset";

const GENERIC_MESSAGE =
  "Falls ein Account mit dieser E-Mail existiert, erhalten Sie eine E-Mail mit Anweisungen.";

/**
 * POST /api/portal/password-reset/request
 *
 * Public endpoint -- sends a password reset email to a MANDANT user.
 * Always returns 200 to prevent email enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    // Find MANDANT user by email
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        role: "MANDANT",
        aktiv: true,
      },
    });

    if (!user) {
      // Do not reveal whether user exists
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token on user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Build reset URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/portal/passwort-reset?token=${resetToken}`;

    // Fetch Kanzlei name from Briefkopf
    const briefkopf = await prisma.briefkopf.findFirst({
      where: { istStandard: true },
      select: { kanzleiName: true },
    });
    const kanzleiName = briefkopf?.kanzleiName ?? "Kanzlei";

    // Send email
    const emailContent = portalPasswordResetEmail({
      name: user.name,
      resetUrl,
      kanzleiName,
    });

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  } catch (error) {
    console.error("Password reset request error:", error);
    // Still return 200 to prevent information leakage
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }
}
