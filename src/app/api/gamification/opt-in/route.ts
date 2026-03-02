/**
 * GET  /api/gamification/opt-in  -- returns current opt-in status
 * PATCH /api/gamification/opt-in -- toggles gamificationOptIn on User model
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateGameProfile } from "@/lib/gamification/game-profile-service";

// GET -- return current opt-in boolean
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gamificationOptIn: true },
  });

  return NextResponse.json({
    gamificationOptIn: user?.gamificationOptIn ?? false,
  });
}

// PATCH -- toggle opt-in on/off
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  let body: { optIn?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger JSON-Body" },
      { status: 400 },
    );
  }

  if (typeof body.optIn !== "boolean") {
    return NextResponse.json(
      { error: "optIn muss ein Boolean sein" },
      { status: 400 },
    );
  }

  const optIn = body.optIn;

  // Update the user record
  await prisma.user.update({
    where: { id: session.user.id },
    data: { gamificationOptIn: optIn },
  });

  // If toggling ON, ensure a GameProfile exists so the widget works immediately
  if (optIn) {
    try {
      await getOrCreateGameProfile(
        session.user.id,
        session.user.role as Parameters<typeof getOrCreateGameProfile>[1],
      );
    } catch {
      // Non-blocking: profile creation is best-effort
    }
  }

  return NextResponse.json({ gamificationOptIn: optIn });
}
