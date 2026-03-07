import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";

const TOTP_PENDING_COOKIE = "totp_pending";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/totp/init
 * First step of the two-factor login flow.
 * Validates credentials; if the user has TOTP enabled, sets the totp_pending
 * cookie (a signed JWT containing userId) and stores a one-time nonce in the DB,
 * then returns { requireTotp: true }.
 * If TOTP is not enabled, returns { requireTotp: false } so the client can
 * proceed with the normal NextAuth signIn call.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      aktiv: true,
      totpEnabled: true,
    },
  });

  if (!user || !user.aktiv) {
    return NextResponse.json(
      { error: "Ungültige Anmeldedaten" },
      { status: 401 }
    );
  }

  const passwordMatch = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash
  );

  if (!passwordMatch) {
    return NextResponse.json(
      { error: "Ungültige Anmeldedaten" },
      { status: 401 }
    );
  }

  if (!user.totpEnabled) {
    // No TOTP — client should proceed with normal signIn
    return NextResponse.json({ requireTotp: false });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Serverkonfigurationsfehler" },
      { status: 500 }
    );
  }

  // Generate a one-time nonce and store it on the user row
  const nonce = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { totpNonce: nonce },
  });

  // Sign a short-lived JWT containing only the userId for the challenge cookie
  const token = jwt.sign(
    { userId: user.id, type: "totp_pending" },
    secret,
    { expiresIn: "10m" }
  );

  const res = NextResponse.json({ requireTotp: true });
  res.cookies.set(TOTP_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });
  return res;
}
