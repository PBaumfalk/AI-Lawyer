import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTotpSecret } from "@/lib/totp";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  if (role === "MANDANT") {
    return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
  }

  const userId = session.user.id;

  // Get user email for QR code label
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const { secret, qrCodeDataUrl } = await generateTotpSecret(user.email);

  // Store secret temporarily (not yet enabled — user must verify first)
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      totpEnabled: false,
    },
  });

  return NextResponse.json({ qrCodeDataUrl, secret });
}
