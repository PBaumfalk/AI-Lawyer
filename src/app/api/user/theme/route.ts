import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/user/theme — returns { theme: "system" | "light" | "dark" }
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ theme: "system" });
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { theme: true },
  });
  return NextResponse.json({ theme: settings?.theme ?? "system" });
}

// PATCH /api/user/theme — body: { theme: "system" | "light" | "dark" }
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { theme } = await request.json();
  if (!["system", "light", "dark"].includes(theme)) {
    return NextResponse.json({ error: "Invalid theme value" }, { status: 400 });
  }
  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: { theme },
    create: { userId: session.user.id, theme },
  });
  return NextResponse.json({ theme });
}
