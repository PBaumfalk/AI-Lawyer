import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pruefePasswort } from "@/lib/auth-credentials";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import { GERAET_COOKIE, geraetCookieOptionen, geraetTokenErzeugen } from "@/lib/login-geraet";
import { ANMELDESCHUTZ_FEHLT } from "@/lib/login-throttle";

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

  // Same check as the NextAuth credentials provider, including the attempt
  // limit. This endpoint used to compare the password itself without any
  // limit or audit entry, which made it an unthrottled password oracle.
  const pruefung = await pruefePasswort(parsed.data, req, { fuerTotpVorstufe: true });
  if (!pruefung.ok) {
    if (pruefung.grund === "gesperrt") {
      return NextResponse.json(
        { error: "Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }
    if (pruefung.grund === "dienst") {
      return NextResponse.json(
        { error: ANMELDESCHUTZ_FEHLT },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }
    return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
  }
  const user = pruefung.user;

  if (!user.totpEnabled) {
    // No TOTP — client should proceed with normal signIn. The password was
    // correct: remember this device so that a distributed guessing attack on
    // the account cannot lock its owner out (see login-throttle.ts).
    const res = NextResponse.json({ requireTotp: false });
    const geraet = geraetTokenErzeugen(user.email);
    if (geraet) res.cookies.set(GERAET_COOKIE, geraet, geraetCookieOptionen);
    return res;
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
