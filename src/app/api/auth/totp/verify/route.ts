import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { verifyTotpCode, verifyBackupCode } from "@/lib/totp";
import { logAuditEvent } from "@/lib/audit";

const TOTP_PENDING_COOKIE = "totp_pending";

interface TotpPendingPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(TOTP_PENDING_COOKIE)?.value;

  if (!pendingToken) {
    return NextResponse.json({ error: "Kein aktiver 2FA-Login-Vorgang" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Serverkonfigurationsfehler" }, { status: 500 });
  }

  let payload: TotpPendingPayload;
  try {
    payload = jwt.verify(pendingToken, secret) as TotpPendingPayload;
  } catch {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Login-Token" }, { status: 401 });
  }

  const userId = payload.userId;

  const body = await request.json();
  const code: string = body?.code;
  const isBackupCode: boolean = body?.isBackupCode === true;

  if (!code) {
    return NextResponse.json({ error: "Code erforderlich" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true, backupCodes: true },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "Zwei-Faktor-Authentifizierung ist nicht konfiguriert" }, { status: 400 });
  }

  if (isBackupCode) {
    const result = await verifyBackupCode(code, user.backupCodes);

    if (!result.valid) {
      return NextResponse.json({ error: "Ungültiger Code" }, { status: 401 });
    }

    // Consume the backup code
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: result.remainingCodes },
    });
  } else {
    const isValid = verifyTotpCode(user.totpSecret, code);

    if (!isValid) {
      return NextResponse.json({ error: "Ungültiger Code" }, { status: 401 });
    }
  }

  // Clear the pending cookie on success
  const response = NextResponse.json({ success: true });
  response.cookies.set(TOTP_PENDING_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  await logAuditEvent({
    userId,
    aktion: "TOTP_LOGIN_ERFOLG",
    details: { method: isBackupCode ? "backup_code" : "totp" },
  });

  return response;
}
