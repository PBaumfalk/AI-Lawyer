import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotpCode, generateBackupCodes } from "@/lib/totp";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  if (role === "MANDANT") {
    return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
  }

  const userId = session.user.id;

  const body = await request.json();
  const code: string = body?.code;

  if (!code) {
    return NextResponse.json({ error: "Code erforderlich" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });

  if (!user?.totpSecret) {
    return NextResponse.json({ error: "Kein TOTP-Setup gefunden. Bitte Setup neu starten." }, { status: 400 });
  }

  const isValid = verifyTotpCode(user.totpSecret, code);
  if (!isValid) {
    return NextResponse.json({ error: "Ungültiger Code" }, { status: 400 });
  }

  const { plain, hashed } = await generateBackupCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      backupCodes: hashed,
    },
  });

  await logAuditEvent({
    userId,
    aktion: "TOTP_AKTIVIERT",
    details: { method: "totp" },
  });

  return NextResponse.json({ success: true, backupCodes: plain });
}
