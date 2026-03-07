import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, backupCodes: true },
  });

  return NextResponse.json({
    totpEnabled: user?.totpEnabled ?? false,
    backupCodeCount: user?.backupCodes?.length ?? 0,
  });
}
